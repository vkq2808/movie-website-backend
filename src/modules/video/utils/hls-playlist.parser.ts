import * as fs from 'fs/promises';

export interface PlaylistSegment {
  duration: number;
  uri: string;
  title?: string;
  discontinuity?: boolean;
  programDateTime?: Date;
}

export interface PlaylistMetadata {
  version: number;
  targetDuration: number;
  mediaSequence: number;
  playlistType: 'VOD' | 'LIVE' | 'EVENT';
  endList: boolean;
  segments: PlaylistSegment[];
  totalDuration: number;
}

export class HLSPlaylistParser {
  /**
   * Parse HLS playlist (.m3u8) to extract segment metadata
   * Avoids ffprobe dependency for duration information
   */
  static async parsePlaylist(playlistPath: string): Promise<PlaylistMetadata> {
    try {
      const content = await fs.readFile(playlistPath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      throw new Error(`Failed to parse playlist ${playlistPath}: ${error.message}`);
    }
  }

  /**
   * Parse playlist content string
   */
  static parseContent(content: string): PlaylistMetadata {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const metadata: PlaylistMetadata = {
      version: 3,
      targetDuration: 0,
      mediaSequence: 0,
      playlistType: 'LIVE',
      endList: false,
      segments: [],
      totalDuration: 0,
    };

    let currentSegment: PlaylistSegment | null = null;

    for (const line of lines) {
      if (line.startsWith('#EXTM3U')) {
        continue;
      }

      if (line.startsWith('#EXT-X-VERSION:')) {
        metadata.version = parseInt(line.split(':')[1], 10) || 3;
      } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        metadata.targetDuration = parseInt(line.split(':')[1], 10) || 0;
      } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        metadata.mediaSequence = parseInt(line.split(':')[1], 10) || 0;
      } else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
        const type = line.split(':')[1];
        if (['VOD', 'LIVE', 'EVENT'].includes(type)) {
          metadata.playlistType = type as any;
        }
      } else if (line === '#EXT-X-ENDLIST') {
        metadata.endList = true;
      } else if (line.startsWith('#EXTINF:')) {
        currentSegment = this.parseExtInf(line);
      } else if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        if (currentSegment) {
          currentSegment.discontinuity = true;
        }
      } else if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
        if (currentSegment) {
          const dateTimeStr = line.split(':')[1];
          currentSegment.programDateTime = new Date(dateTimeStr);
        }
      } else if (!line.startsWith('#') && currentSegment) {
        // This is the URI line
        currentSegment.uri = line;
        metadata.segments.push(currentSegment);
        currentSegment = null;
      }
    }

    // Calculate total duration
    metadata.totalDuration = metadata.segments.reduce((sum, seg) => sum + seg.duration, 0);

    return metadata;
  }

  /**
   * Parse #EXTINF tag
   */
  private static parseExtInf(line: string): PlaylistSegment {
    const parts = line.split(',');
    const durationStr = parts[0].replace('#EXTINF:', '').trim();
    const duration = parseFloat(durationStr) || 0;
    const title = parts.length > 1 ? parts[1].trim() : undefined;

    return {
      duration,
      uri: '',
      title,
    };
  }

  /**
   * Get segment duration from playlist without ffprobe
   */
  static async getSegmentDurationFromPlaylist(
    playlistPath: string,
    segmentUri: string,
  ): Promise<number> {
    try {
      const metadata = await this.parsePlaylist(playlistPath);
      const segment = metadata.segments.find(s => s.uri === segmentUri);
      return segment?.duration || 0;
    } catch (error) {
      console.warn(`[HLSPlaylistParser] Failed to get duration from playlist:`, error);
      return 0;
    }
  }

  /**
   * Check if playlist indicates completion
   */
  static async isPlaylistComplete(playlistPath: string): Promise<boolean> {
    try {
      const metadata = await this.parsePlaylist(playlistPath);
      return metadata.endList;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get expected segment count from playlist
   */
  static async getExpectedSegmentCount(playlistPath: string): Promise<number> {
    try {
      const metadata = await this.parsePlaylist(playlistPath);
      return metadata.segments.length;
    } catch (error) {
      return 0;
    }
  }
}