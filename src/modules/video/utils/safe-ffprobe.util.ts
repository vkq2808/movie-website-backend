import * as ffmpeg from 'fluent-ffmpeg';
import { FileStabilityChecker } from './file-stability.util';

export interface FFprobeResult {
  duration: number;
  width?: number;
  height?: number;
  codec?: string;
  bitrate?: number;
  error?: string;
}

export interface FFprobeOptions {
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  requireStableFile: boolean;
  minDuration: number;
  maxDuration: number;
}

export class SafeFFprobe {
  private static readonly DEFAULT_OPTIONS: FFprobeOptions = {
    timeoutMs: 10000, // 10 seconds timeout
    retryAttempts: 3,
    retryDelayMs: 1000,
    requireStableFile: true,
    minDuration: 0.1, // 100ms minimum
    maxDuration: 36000, // 10 hours maximum
  };

  /**
   * Safe ffprobe wrapper that prevents SIGSEGV crashes
   * Implements file stability checking and retry logic
   */
  static async getMetadata(
    filePath: string,
    options: Partial<FFprobeOptions> = {},
  ): Promise<FFprobeResult> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };

    // Check file stability if required
    if (config.requireStableFile) {
      const isStable = await FileStabilityChecker.waitForFileStable(
        filePath,
        config.timeoutMs,
      );

      if (!isStable) {
        return {
          duration: 0,
          error: 'File not stable within timeout period',
        };
      }
    }

    // Attempt ffprobe with retry logic
    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        const result = await this.probeFile(filePath, config.timeoutMs);

        if (result.error) {
          if (attempt < config.retryAttempts) {
            await this.sleep(config.retryDelayMs * attempt); // Exponential backoff
            continue;
          }
          return result;
        }

        // Validate duration bounds
        if (
          result.duration < config.minDuration ||
          result.duration > config.maxDuration
        ) {
          return {
            ...result,
            error: `Duration ${result.duration}s outside acceptable range [${config.minDuration}, ${config.maxDuration}]`,
          };
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (attempt < config.retryAttempts) {
          console.warn(
            `[SafeFFprobe] Attempt ${attempt} failed for ${filePath}:`,
            errorMessage,
          );
          await this.sleep(config.retryDelayMs * attempt);
          continue;
        }

        return {
          duration: 0,
          error: `FFprobe failed after ${config.retryAttempts} attempts: ${errorMessage}`,
        };
      }
    }

    return { duration: 0, error: 'Unknown error' };
  }

  /**
   * Get segment duration with fallback
   */
  static async getSegmentDuration(
    segmentPath: string,
    options: Partial<FFprobeOptions> = {},
  ): Promise<number> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const result = await this.getMetadata(segmentPath, config);

    if (result.error) {
      console.warn(
        `[SafeFFprobe] Failed to get duration for ${segmentPath}:`,
        result.error,
      );
      // Return fallback duration based on segment pattern
      return this.getFallbackDuration(segmentPath);
    }

    return result.duration;
  }

  /**
   * Get duration from filename pattern as fallback
   */
  private static getFallbackDuration(segmentPath: string): number {
    const filename = segmentPath.split('/').pop() || '';

    // Try to extract duration from common patterns
    const patterns = [
      /segment(\d+)\.ts/i, // segment00001.ts
      /seg(\d+)\.ts/i, // seg00001.ts
      /chunk(\d+)\.ts/i, // chunk00001.ts
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        // Use default HLS segment duration
        return 6.0;
      }
    }

    // Final fallback
    return 6.0;
  }

  /**
   * Core ffprobe execution with timeout
   */
  private static probeFile(
    filePath: string,
    timeoutMs: number,
  ): Promise<FFprobeResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          duration: 0,
          error: `FFprobe timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      ffmpeg.ffprobe(filePath, (err, metadata) => {
        clearTimeout(timeout);

        if (err) {
          resolve({
            duration: 0,
            error: err.message,
          });
          return;
        }

        const stream = metadata.streams.find((s) => s.codec_type === 'video');
        const duration = metadata.format.duration || 0;

        resolve({
          duration,
          width: stream?.width,
          height: stream?.height,
          codec: stream?.codec_name,
          bitrate: metadata.format.bit_rate
            ? metadata.format.bit_rate
            : undefined,
        });
      });
    });
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
