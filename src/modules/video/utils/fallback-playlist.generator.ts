import * as fs from 'fs/promises';
import * as path from 'path';

export interface FallbackPlaylistConfig {
  segmentDuration: number;
  targetDuration: number;
  enableProgramDateTime: boolean;
  videoStartTime: Date;
}

export class FallbackPlaylistGenerator {
  /**
   * Generate fallback playlist when original is not ready
   * This is used as a safety net when ffmpeg is still writing
   */
  static async generateFallbackVODPlaylist(
    hlsDir: string,
    config: FallbackPlaylistConfig,
  ): Promise<void> {
    try {
      const files = await fs.readdir(hlsDir);
      const segments = files
        .filter((f) => f.startsWith('segment') && f.endsWith('.ts'))
        .sort();

      if (segments.length === 0) {
        throw new Error('No segments found for fallback playlist');
      }

      const outputPath = path.join(hlsDir, 'index.m3u8');
      const lines: string[] = [];

      lines.push('#EXTM3U');
      lines.push('#EXT-X-VERSION:7');
      lines.push('#EXT-X-PLAYLIST-TYPE:VOD');
      lines.push(`#EXT-X-TARGETDURATION:${config.targetDuration}`);
      lines.push('#EXT-X-MEDIA-SEQUENCE:0');

      if (config.enableProgramDateTime) {
        lines.push(
          `#EXT-X-PROGRAM-DATE-TIME:${config.videoStartTime.toISOString()}`,
        );
      }

      for (const segment of segments) {
        lines.push(`#EXTINF:${config.segmentDuration.toFixed(3)},`);
        lines.push(segment);
      }

      lines.push('#EXT-X-ENDLIST');

      await fs.writeFile(outputPath, lines.join('\n') + '\n');
      console.log(
        `[Fallback] Generated VOD playlist with ${segments.length} segments`,
      );
    } catch (error) {
      console.error(`[Fallback] Failed to generate VOD playlist:`, error);
      throw error;
    }
  }

  /**
   * Generate fallback LIVE playlist when original is not ready
   */
  static async generateFallbackLivePlaylist(
    hlsDir: string,
    config: FallbackPlaylistConfig,
  ): Promise<void> {
    try {
      const files = await fs.readdir(hlsDir);
      const segments = files
        .filter((f) => f.startsWith('segment') && f.endsWith('.ts'))
        .sort();

      if (segments.length === 0) {
        throw new Error('No segments found for fallback playlist');
      }

      const outputPath = path.join(hlsDir, 'live.m3u8');
      const lines: string[] = [];

      lines.push('#EXTM3U');
      lines.push('#EXT-X-VERSION:7');
      lines.push('#EXT-X-PLAYLIST-TYPE:EVENT');
      lines.push(`#EXT-X-TARGETDURATION:${config.targetDuration}`);
      lines.push('#EXT-X-MEDIA-SEQUENCE:0');

      if (config.enableProgramDateTime) {
        lines.push(
          `#EXT-X-PROGRAM-DATE-TIME:${config.videoStartTime.toISOString()}`,
        );
      }

      lines.push(
        `#EXT-X-CUSTOM-START-TIME:${Math.floor(config.videoStartTime.getTime() / 1000)}`,
      );
      lines.push(`#EXT-X-CUSTOM-SEGMENT-DURATION:${config.segmentDuration}`);
      lines.push(
        `#EXT-X-CUSTOM-REWIND-DURATION:${config.segmentDuration * 20}`,
      );

      for (const segment of segments) {
        lines.push(`#EXTINF:${config.segmentDuration.toFixed(3)},`);
        lines.push(segment);
      }

      await fs.writeFile(outputPath, lines.join('\n') + '\n');
      console.log(
        `[Fallback] Generated LIVE playlist with ${segments.length} segments`,
      );
    } catch (error) {
      console.error(`[Fallback] Failed to generate LIVE playlist:`, error);
      throw error;
    }
  }

  /**
   * Check if fallback is needed
   */
  static async needsFallback(hlsDir: string): Promise<boolean> {
    try {
      const playlistPath = path.join(hlsDir, 'index.m3u8');
      await fs.access(playlistPath);
      return false; // Playlist exists, no fallback needed
    } catch (error) {
      return true; // Playlist doesn't exist, fallback needed
    }
  }
}
