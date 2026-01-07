import * as fs from 'fs/promises';
import * as path from 'path';

export enum HLSProcessingState {
  TRANSCODING = 'transcoding',
  HLS_INITIALIZED = 'hls_initialized',
  HLS_READY = 'hls_ready',
  FAILED = 'failed',
}

export interface HLSState {
  state: HLSProcessingState;
  timestamp: number;
  hlsDir: string;
  playlistPath: string;
  segments: string[];
  error?: string;
}

export class HLSStateManager {
  private static readonly STATE_FILE = 'hls.state.json';
  private static readonly STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Initialize HLS processing state
   */
  static async initialize(hlsDir: string): Promise<HLSState> {
    const state: HLSState = {
      state: HLSProcessingState.TRANSCODING,
      timestamp: Date.now(),
      hlsDir,
      playlistPath: path.join(hlsDir, 'index.m3u8'),
      segments: [],
      error: undefined,
    };

    await this.saveState(hlsDir, state);
    return state;
  }

  /**
   * Update HLS state
   */
  static async updateState(
    hlsDir: string,
    updates: Partial<HLSState>,
  ): Promise<HLSState> {
    const currentState = await this.getState(hlsDir);
    const newState = { ...currentState, ...updates, timestamp: Date.now() };
    await this.saveState(hlsDir, newState);
    return newState;
  }

  /**
   * Mark HLS as ready for processing
   */
  static async markReady(hlsDir: string): Promise<HLSState> {
    return this.updateState(hlsDir, { state: HLSProcessingState.HLS_READY });
  }

  /**
   * Mark HLS processing as failed
   */
  static async markFailed(hlsDir: string, error: string): Promise<HLSState> {
    return this.updateState(hlsDir, {
      state: HLSProcessingState.FAILED,
      error,
    });
  }

  /**
   * Get current HLS state
   */
  static async getState(hlsDir: string): Promise<HLSState> {
    try {
      const statePath = path.join(hlsDir, this.STATE_FILE);
      const stateData = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(stateData);
    } catch (error) {
      // If state file doesn't exist, return default state
      return {
        state: HLSProcessingState.TRANSCODING,
        timestamp: Date.now(),
        hlsDir,
        playlistPath: path.join(hlsDir, 'index.m3u8'),
        segments: [],
      };
    }
  }

  /**
   * Check if HLS is ready for processing
   */
  static async isReady(hlsDir: string): Promise<boolean> {
    const state = await this.getState(hlsDir);
    return state.state === HLSProcessingState.HLS_READY;
  }

  /**
   * Wait for HLS to be ready
   */
  static async waitForReady(
    hlsDir: string,
    timeoutMs: number = 600000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const state = await this.getState(hlsDir);

      if (state.state === HLSProcessingState.HLS_READY) {
        return true;
      }

      if (state.state === HLSProcessingState.FAILED) {
        throw new Error(`HLS processing failed: ${state.error}`);
      }

      await this.sleep(1000); // Check every second
    }

    throw new Error(`HLS processing timeout after ${timeoutMs}ms`);
  }

  /**
   * Clean up HLS state
   */
  static async cleanup(hlsDir: string): Promise<void> {
    try {
      const statePath = path.join(hlsDir, this.STATE_FILE);
      await fs.unlink(statePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Validate HLS directory structure
   */
  static async validateHLSReady(hlsDir: string): Promise<boolean> {
    try {
      // Check if playlist exists
      const playlistPath = path.join(hlsDir, 'index.m3u8');
      await fs.access(playlistPath);

      // Check if at least one segment exists
      const files = await fs.readdir(hlsDir);
      const segments = files.filter(
        (f) => f.startsWith('segment') && f.endsWith('.ts'),
      );

      return segments.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get playlist path safely
   */
  static getPlaylistPath(hlsDir: string): string {
    return path.join(hlsDir, 'index.m3u8');
  }

  /**
   * Get all segment paths
   */
  static async getSegmentPaths(hlsDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(hlsDir);
      const segments = files
        .filter((f) => f.startsWith('segment') && f.endsWith('.ts'))
        .sort()
        .map((f) => path.join(hlsDir, f));

      return segments;
    } catch (error) {
      return [];
    }
  }

  private static async saveState(
    hlsDir: string,
    state: HLSState,
  ): Promise<void> {
    const statePath = path.join(hlsDir, this.STATE_FILE);
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
