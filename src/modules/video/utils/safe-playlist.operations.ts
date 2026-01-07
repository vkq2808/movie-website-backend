import * as fs from 'fs/promises';
import * as path from 'path';
import { HLSStateManager, HLSProcessingState } from './hls-state.manager';
import { HLSPlaylistParser } from './hls-playlist.parser';

export interface SafePlaylistResult {
  success: boolean;
  data?: any;
  error?: string;
  retryable: boolean;
}

export class SafePlaylistOperations {
  private static readonly MAX_RETRY_ATTEMPTS = 5;
  private static readonly RETRY_DELAY_MS = 2000;

  /**
   * Wait for playlist to exist and be readable
   */
  static async waitForPlaylistReady(
    hlsDir: string,
    timeoutMs: number = 300000,
  ): Promise<SafePlaylistResult> {
    const playlistPath = HLSStateManager.getPlaylistPath(hlsDir);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check if file exists and is readable
        await fs.access(playlistPath);

        // Try to read the file
        const content = await fs.readFile(playlistPath, 'utf-8');

        if (content.trim().length > 0) {
          return {
            success: true,
            data: { playlistPath, content },
            retryable: false,
          };
        }
      } catch (error) {
        // File doesn't exist or not readable yet
      }

      await this.sleep(1000);
    }

    return {
      success: false,
      error: `Playlist not ready after ${timeoutMs}ms`,
      retryable: false,
    };
  }

  /**
   * Parse playlist safely with retry logic
   */
  static async parsePlaylistSafely(
    hlsDir: string,
    maxAttempts: number = this.MAX_RETRY_ATTEMPTS,
  ): Promise<SafePlaylistResult> {
    const playlistPath = HLSStateManager.getPlaylistPath(hlsDir);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // First, ensure playlist exists
        const waitResult = await this.waitForPlaylistReady(hlsDir, 30000);

        if (!waitResult.success) {
          return {
            success: false,
            error: waitResult.error,
            retryable: attempt < maxAttempts,
          };
        }

        // Parse the playlist
        const metadata = await HLSPlaylistParser.parsePlaylist(playlistPath);

        return {
          success: true,
          data: metadata,
          retryable: false,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (attempt < maxAttempts) {
          console.warn(
            `[SafePlaylistOperations] Attempt ${attempt} failed for ${playlistPath}:`,
            errorMessage,
          );
          await this.sleep(this.RETRY_DELAY_MS * attempt);
          continue;
        }

        return {
          success: false,
          error: `Failed to parse playlist after ${maxAttempts} attempts: ${errorMessage}`,
          retryable: false,
        };
      }
    }

    return {
      success: false,
      error: 'Unknown error',
      retryable: false,
    };
  }

  /**
   * Get segment duration from playlist without ffprobe
   */
  static async getSegmentDurationFromPlaylist(
    hlsDir: string,
    segmentFilename: string,
  ): Promise<SafePlaylistResult> {
    try {
      const parseResult = await this.parsePlaylistSafely(hlsDir);

      if (!parseResult.success) {
        return parseResult;
      }

      const metadata = parseResult.data as any;
      const segment = metadata.segments.find(
        (s: any) => s.uri === segmentFilename,
      );

      if (!segment) {
        return {
          success: false,
          error: `Segment ${segmentFilename} not found in playlist`,
          retryable: false,
        };
      }

      return {
        success: true,
        data: { duration: segment.duration },
        retryable: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }

  /**
   * Validate playlist completeness
   */
  static async validatePlaylistCompleteness(
    hlsDir: string,
  ): Promise<SafePlaylistResult> {
    try {
      const parseResult = await this.parsePlaylistSafely(hlsDir);

      if (!parseResult.success) {
        return parseResult;
      }

      const metadata = parseResult.data as any;

      // Check if playlist has required structure
      if (!metadata.segments || metadata.segments.length === 0) {
        return {
          success: false,
          error: 'Playlist has no segments',
          retryable: true,
        };
      }

      // Check if all segments exist
      const missingSegments: string[] = [];
      for (const segment of metadata.segments) {
        const segmentPath = path.join(hlsDir, segment.uri);
        try {
          await fs.access(segmentPath);
        } catch (error) {
          missingSegments.push(segment.uri);
        }
      }

      if (missingSegments.length > 0) {
        return {
          success: false,
          error: `Missing segments: ${missingSegments.join(', ')}`,
          retryable: true,
        };
      }

      return {
        success: true,
        data: {
          segmentCount: metadata.segments.length,
          totalDuration: metadata.totalDuration,
          targetDuration: metadata.targetDuration,
        },
        retryable: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }

  /**
   * Get all segment durations from playlist
   */
  static async getAllSegmentDurations(
    hlsDir: string,
  ): Promise<SafePlaylistResult> {
    try {
      const parseResult = await this.parsePlaylistSafely(hlsDir);

      if (!parseResult.success) {
        return parseResult;
      }

      const metadata = parseResult.data as any;

      const durations = metadata.segments.map((segment: any) => ({
        filename: segment.uri,
        duration: segment.duration,
      }));

      return {
        success: true,
        data: { durations, totalDuration: metadata.totalDuration },
        retryable: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }

  /**
   * Check if HLS processing is complete and ready
   */
  static async isHLSReadyForProcessing(
    hlsDir: string,
  ): Promise<SafePlaylistResult> {
    try {
      // Check state manager
      const isReady = await HLSStateManager.isReady(hlsDir);

      if (!isReady) {
        return {
          success: false,
          error: 'HLS processing not ready',
          retryable: true,
        };
      }

      // Check if playlist exists first
      const playlistPath = HLSStateManager.getPlaylistPath(hlsDir);
      try {
        await fs.access(playlistPath);
      } catch (error) {
        // Playlist doesn't exist yet, but HLS state is ready
        // This is normal during ffmpeg processing
        return {
          success: false,
          error: 'Playlist not ready - still being written by ffmpeg',
          retryable: true,
        };
      }

      // Validate playlist completeness
      const validation = await this.validatePlaylistCompleteness(hlsDir);

      if (!validation.success) {
        return validation;
      }

      return {
        success: true,
        data: validation.data,
        retryable: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }

  /**
   * Create playlist with proper error handling
   */
  static async createPlaylistSafely(
    hlsDir: string,
    content: string,
    filename: string = 'index.m3u8',
  ): Promise<SafePlaylistResult> {
    try {
      const playlistPath = path.join(hlsDir, filename);

      // Ensure directory exists
      await fs.mkdir(hlsDir, { recursive: true });

      // Write playlist atomically
      const tempPath = `${playlistPath}.tmp`;
      await fs.writeFile(tempPath, content);
      await fs.rename(tempPath, playlistPath);

      return {
        success: true,
        data: { playlistPath },
        retryable: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
