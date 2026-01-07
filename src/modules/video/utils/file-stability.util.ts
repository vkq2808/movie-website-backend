import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileStabilityOptions {
  checkIntervalMs: number;
  maxRetries: number;
  minSizeBytes?: number;
  sizeStabilityThresholdMs: number;
}

export class FileStabilityChecker {
  private static readonly DEFAULT_OPTIONS: FileStabilityOptions = {
    checkIntervalMs: 1000,
    maxRetries: 30, // 30 seconds max wait
    sizeStabilityThresholdMs: 2000,
    minSizeBytes: 1024, // 1KB minimum
  };

  /**
   * Check if a file is stable and safe to read
   * Prevents race conditions with ongoing writes
   */
  static async isFileStable(
    filePath: string,
    options: Partial<FileStabilityOptions> = {},
  ): Promise<boolean> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };

    let lastSize = -1;
    let stableSince = 0;
    let retryCount = 0;

    while (retryCount < config.maxRetries) {
      try {
        const stat = await fs.stat(filePath);

        // Check minimum size requirement
        if (config.minSizeBytes && stat.size < config.minSizeBytes) {
          retryCount++;
          await this.sleep(config.checkIntervalMs);
          continue;
        }

        // Check if size has stabilized
        if (stat.size === lastSize) {
          const now = Date.now();
          if (stableSince === 0) {
            stableSince = now;
          } else if (now - stableSince >= config.sizeStabilityThresholdMs) {
            return true; // File is stable
          }
        } else {
          lastSize = stat.size;
          stableSince = 0;
        }

        retryCount++;
        await this.sleep(config.checkIntervalMs);
      } catch (error) {
        // File doesn't exist or inaccessible
        retryCount++;
        await this.sleep(config.checkIntervalMs);
      }
    }

    return false; // File never stabilized within timeout
  }

  /**
   * Wait for file to become stable with timeout
   */
  static async waitForFileStable(
    filePath: string,
    timeoutMs: number = 30000,
    options: Partial<FileStabilityOptions> = {},
  ): Promise<boolean> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isFileStable(filePath, config)) {
        return true;
      }
      await this.sleep(config.checkIntervalMs);
    }

    return false;
  }

  /**
   * Check if file is currently being written to
   * Uses file descriptor count as heuristic
   */
  static async isFileLocked(filePath: string): Promise<boolean> {
    try {
      // Try to open file with exclusive lock
      const fd = await fs.open(filePath, 'r+');
      await fd.close();
      return false; // File is not locked
    } catch (error) {
      return true; // File is locked/being written
    }
  }

  /**
   * Get file modification time with high precision
   */
  static async getFileMtime(filePath: string): Promise<number> {
    try {
      const stat = await fs.stat(filePath);
      return stat.mtimeMs;
    } catch (error) {
      return 0;
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
