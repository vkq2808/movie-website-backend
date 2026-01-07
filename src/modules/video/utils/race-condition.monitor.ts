import * as fs from 'fs/promises';
import * as path from 'path';

export interface RaceConditionMetrics {
  timestamp: number;
  segmentPath: string;
  fileSize: number;
  isStable: boolean;
  ffprobeAttempts: number;
  duration: number;
  error?: string;
}

export interface MonitoringConfig {
  logFile: string;
  alertThresholdMs: number;
  maxFileSizeDiff: number;
  enableDetailedLogging: boolean;
}

export class RaceConditionMonitor {
  private static readonly DEFAULT_CONFIG: MonitoringConfig = {
    logFile: path.join(process.cwd(), 'logs', 'race-conditions.log'),
    alertThresholdMs: 30000, // 30 seconds
    maxFileSizeDiff: 1024, // 1KB
    enableDetailedLogging: true,
  };

  private static metrics: RaceConditionMetrics[] = [];
  private static config: MonitoringConfig;

  static initialize(config?: Partial<MonitoringConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.ensureLogDirectory();
  }

  /**
   * Monitor file stability and detect race conditions
   */
  static async monitorFileStability(
    filePath: string,
    timeoutMs: number = 30000,
  ): Promise<{ isStable: boolean; metrics: RaceConditionMetrics }> {
    const startTime = Date.now();
    const initialSize = await this.getFileSize(filePath);
    const metrics: RaceConditionMetrics = {
      timestamp: startTime,
      segmentPath: filePath,
      fileSize: initialSize,
      isStable: false,
      ffprobeAttempts: 0,
      duration: 0,
    };

    try {
      // Monitor file size changes
      let lastSize = initialSize;
      let stableSince = 0;
      let checkCount = 0;

      while (Date.now() - startTime < timeoutMs) {
        const currentSize = await this.getFileSize(filePath);
        checkCount++;

        if (currentSize === lastSize) {
          if (stableSince === 0) {
            stableSince = Date.now();
          } else if (Date.now() - stableSince >= 2000) {
            // File has been stable for 2 seconds
            metrics.isStable = true;
            metrics.fileSize = currentSize;
            break;
          }
        } else {
          lastSize = currentSize;
          stableSince = 0;
        }

        await this.sleep(500);
      }

      // Log metrics
      this.logMetrics(metrics);

      // Check for potential race condition
      if (!metrics.isStable && checkCount > 0) {
        this.logAlert(`Potential race condition detected for ${filePath}`);
      }

      return { isStable: metrics.isStable, metrics };
    } catch (error) {
      metrics.error = error instanceof Error ? error.message : String(error);
      this.logMetrics(metrics);
      return { isStable: false, metrics };
    }
  }

  /**
   * Monitor ffprobe operations for crashes
   */
  static async monitorFFprobeOperation(
    operation: () => Promise<number>,
    segmentPath: string,
  ): Promise<number> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | null = null;

    try {
      const duration = await operation();
      const metrics: RaceConditionMetrics = {
        timestamp: startTime,
        segmentPath,
        fileSize: await this.getFileSize(segmentPath),
        isStable: true,
        ffprobeAttempts: 1,
        duration,
      };

      this.logMetrics(metrics);
      return duration;
    } catch (error) {
      attempts++;
      lastError = error instanceof Error ? error.message : String(error);

      const metrics: RaceConditionMetrics = {
        timestamp: startTime,
        segmentPath,
        fileSize: await this.getFileSize(segmentPath),
        isStable: false,
        ffprobeAttempts: attempts,
        duration: 0,
        error: lastError,
      };

      this.logMetrics(metrics);
      this.logAlert(
        `FFprobe operation failed for ${segmentPath}: ${lastError}`,
      );

      throw error;
    }
  }

  /**
   * Get file size safely
   */
  private static async getFileSize(filePath: string): Promise<number> {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Log metrics to file and memory
   */
  private static async logMetrics(
    metrics: RaceConditionMetrics,
  ): Promise<void> {
    if (!this.config.enableDetailedLogging) return;

    try {
      const logEntry = JSON.stringify(metrics) + '\n';
      await fs.appendFile(this.config.logFile, logEntry);
      this.metrics.push(metrics);

      // Keep only last 1000 entries in memory
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }
    } catch (error) {
      console.warn('[RaceConditionMonitor] Failed to log metrics:', error);
    }
  }

  /**
   * Log alert for race condition detection
   */
  private static async logAlert(message: string): Promise<void> {
    const alertEntry = `[ALERT] ${new Date().toISOString()} - ${message}\n`;

    try {
      await fs.appendFile(this.config.logFile, alertEntry);
      console.warn(`[RACE CONDITION ALERT] ${message}`);
    } catch (error) {
      console.warn('[RaceConditionMonitor] Failed to log alert:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  static getStatistics(): {
    totalOperations: number;
    stableOperations: number;
    unstableOperations: number;
    averageStabilityTime: number;
    recentErrors: string[];
  } {
    const totalOperations = this.metrics.length;
    const stableOperations = this.metrics.filter((m) => m.isStable).length;
    const unstableOperations = this.metrics.filter((m) => !m.isStable).length;

    const stabilityTimes = this.metrics
      .filter((m) => m.isStable)
      .map((m) => Date.now() - m.timestamp);

    const averageStabilityTime =
      stabilityTimes.length > 0
        ? stabilityTimes.reduce((sum, time) => sum + time, 0) /
          stabilityTimes.length
        : 0;

    const recentErrors = this.metrics
      .filter((m) => m.error)
      .map((m) => m.error!)
      .slice(-10);

    return {
      totalOperations,
      stableOperations,
      unstableOperations,
      averageStabilityTime,
      recentErrors,
    };
  }

  /**
   * Generate diagnostic report
   */
  static async generateReport(outputPath?: string): Promise<string> {
    const stats = this.getStatistics();
    const report = `
# Race Condition Monitoring Report

## Summary
- Total Operations: ${stats.totalOperations}
- Stable Operations: ${stats.stableOperations}
- Unstable Operations: ${stats.unstableOperations}
- Success Rate: ${stats.totalOperations > 0 ? ((stats.stableOperations / stats.totalOperations) * 100).toFixed(2) : '0'}%

## Performance
- Average Stability Time: ${stats.averageStabilityTime.toFixed(2)}ms

## Recent Errors
${stats.recentErrors.map((error) => `- ${error}`).join('\n')}

## Recommendations
${this.generateRecommendations(stats)}
`;

    if (outputPath) {
      await fs.writeFile(outputPath, report);
      return `Report saved to ${outputPath}`;
    }

    return report;
  }

  /**
   * Generate recommendations based on statistics
   */
  private static generateRecommendations(stats: any): string {
    const recommendations: string[] = [];

    if (stats.unstableOperations > stats.totalOperations * 0.1) {
      recommendations.push(
        '- High instability detected. Consider increasing file stability timeout.',
      );
    }

    if (stats.averageStabilityTime > 5000) {
      recommendations.push(
        '- Long stability times detected. Check disk I/O performance.',
      );
    }

    if (stats.recentErrors.length > 0) {
      recommendations.push(
        '- Recent errors detected. Review error logs for patterns.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('- System appears stable. Continue monitoring.');
    }

    return recommendations.join('\n');
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static async ensureLogDirectory(): Promise<void> {
    try {
      const logDir = path.dirname(this.config.logFile);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.warn(
        '[RaceConditionMonitor] Failed to create log directory:',
        error,
      );
    }
  }
}
