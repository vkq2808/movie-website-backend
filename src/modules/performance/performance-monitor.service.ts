import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Performance statistics interface
 */
interface PerformanceStats {
  operation: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  errors: number;
}

/**
 * Performance alert interface
 */
interface PerformanceAlert {
  type: 'high_latency' | 'high_error_rate' | 'low_throughput';
  operation: string;
  threshold: number;
  actual: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Performance monitoring service
 * Collects, analyzes, and alerts on performance metrics
 */
@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger('PerformanceMonitorService');

  // In-memory metrics storage (could be replaced with database)
  private readonly metrics = new Map<string, PerformanceMetrics[]>();
  private readonly alerts: PerformanceAlert[] = [];

  // Configuration
  private readonly maxMetricsPerOperation: number;
  private readonly alertThresholds: {
    latency: { p95: number; p99: number };
    errorRate: number;
    throughput: number;
  };

  constructor(private readonly configService: ConfigService) {
    this.maxMetricsPerOperation = this.configService.get<number>(
      'PERFORMANCE_MAX_METRICS_PER_OPERATION',
      10000,
    );

    this.alertThresholds = {
      latency: {
        p95: this.configService.get<number>(
          'PERFORMANCE_ALERT_P95_THRESHOLD_MS',
          5000,
        ),
        p99: this.configService.get<number>(
          'PERFORMANCE_ALERT_P99_THRESHOLD_MS',
          10000,
        ),
      },
      errorRate: this.configService.get<number>(
        'PERFORMANCE_ALERT_ERROR_RATE_THRESHOLD',
        0.05,
      ), // 5%
      throughput: this.configService.get<number>(
        'PERFORMANCE_ALERT_THROUGHPUT_THRESHOLD',
        100,
      ), // req/min
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    const metric: PerformanceMetrics = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);

    // Limit metrics storage
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.splice(
        0,
        operationMetrics.length - this.maxMetricsPerOperation,
      );
    }

    // Check for alerts
    this.checkAlerts(operation);
  }

  /**
   * Record an error for an operation
   */
  recordError(
    operation: string,
    error: Error,
    metadata?: Record<string, any>,
  ): void {
    this.recordMetric(operation, 0, {
      ...metadata,
      error: error.message,
      isError: true,
    });
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string): PerformanceStats | null {
    const operationMetrics = this.metrics.get(operation);
    if (!operationMetrics || operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics
      .filter((m) => !m.metadata?.isError)
      .map((m) => m.duration)
      .sort((a, b) => a - b);

    const errors = operationMetrics.filter((m) => m.metadata?.isError).length;

    return {
      operation,
      count: durations.length,
      avg: this.calculateAverage(durations),
      min: durations[0] || 0,
      max: durations[durations.length - 1] || 0,
      p50: this.calculatePercentile(durations, 50),
      p90: this.calculatePercentile(durations, 90),
      p95: this.calculatePercentile(durations, 95),
      p99: this.calculatePercentile(durations, 99),
      errors,
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): PerformanceStats[] {
    const stats: PerformanceStats[] = [];
    for (const operation of this.metrics.keys()) {
      const operationStats = this.getStats(operation);
      if (operationStats) {
        stats.push(operationStats);
      }
    }
    return stats.sort((a, b) => b.avg - a.avg); // Sort by average duration
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 100): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear metrics for an operation
   */
  clearMetrics(operation: string): void {
    this.metrics.delete(operation);
    this.logger.log(`Cleared metrics for operation: ${operation}`);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.logger.log('Cleared all performance metrics');
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    operations: string[];
    totalMetrics: number;
    avgResponseTime: number;
    errorRate: number;
    alertsCount: number;
  } {
    const operations = Array.from(this.metrics.keys());
    const totalMetrics = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0,
    );

    const allStats = this.getAllStats();
    const avgResponseTime =
      allStats.length > 0
        ? allStats.reduce((sum, stat) => sum + stat.avg, 0) / allStats.length
        : 0;

    const totalErrors = allStats.reduce((sum, stat) => sum + stat.errors, 0);
    const errorRate = totalMetrics > 0 ? totalErrors / totalMetrics : 0;

    return {
      operations,
      totalMetrics,
      avgResponseTime,
      errorRate,
      alertsCount: this.alerts.length,
    };
  }

  /**
   * Scheduled task to clean old metrics
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanOldMetrics(): Promise<void> {
    const retentionMs = this.configService.get<number>(
      'PERFORMANCE_METRICS_RETENTION_MS',
      24 * 60 * 60 * 1000,
    ); // 24 hours
    const cutoff = Date.now() - retentionMs;

    for (const [operation, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter((m) => m.timestamp > cutoff);
      if (filteredMetrics.length !== metrics.length) {
        this.metrics.set(operation, filteredMetrics);
        this.logger.debug(`Cleaned old metrics for operation: ${operation}`);
      }
    }
  }

  /**
   * Scheduled task to check performance alerts
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAllAlerts(): Promise<void> {
    for (const operation of this.metrics.keys()) {
      this.checkAlerts(operation);
    }
  }

  /**
   * Check for performance alerts on an operation
   */
  private checkAlerts(operation: string): void {
    const stats = this.getStats(operation);
    if (!stats) return;

    // Check latency alerts
    if (stats.p95 > this.alertThresholds.latency.p95) {
      this.createAlert(
        'high_latency',
        operation,
        this.alertThresholds.latency.p95,
        stats.p95,
        {
          percentile: 'p95',
          current: stats.p95,
        },
      );
    }

    if (stats.p99 > this.alertThresholds.latency.p99) {
      this.createAlert(
        'high_latency',
        operation,
        this.alertThresholds.latency.p99,
        stats.p99,
        {
          percentile: 'p99',
          current: stats.p99,
        },
      );
    }

    // Check error rate alerts
    const errorRate = stats.count > 0 ? stats.errors / stats.count : 0;
    if (errorRate > this.alertThresholds.errorRate) {
      this.createAlert(
        'high_error_rate',
        operation,
        this.alertThresholds.errorRate,
        errorRate,
        {
          errorCount: stats.errors,
          totalCount: stats.count,
          currentRate: errorRate,
        },
      );
    }

    // Check throughput alerts (simplified - just check if we have enough data)
    const recentMetrics = this.getRecentMetrics(operation, 60000); // Last minute
    const throughput = recentMetrics.length;
    if (throughput < this.alertThresholds.throughput && throughput > 0) {
      this.createAlert(
        'low_throughput',
        operation,
        this.alertThresholds.throughput,
        throughput,
        {
          currentThroughput: throughput,
        },
      );
    }
  }

  /**
   * Create and store a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    operation: string,
    threshold: number,
    actual: number,
    metadata?: Record<string, any>,
  ): void {
    const alert: PerformanceAlert = {
      type,
      operation,
      threshold,
      actual,
      timestamp: Date.now(),
      metadata,
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, this.alerts.length - 1000);
    }

    this.logger.warn(`Performance alert: ${type} for ${operation}`, {
      threshold,
      actual,
      metadata,
    });
  }

  /**
   * Get recent metrics for an operation
   */
  private getRecentMetrics(
    operation: string,
    timeWindowMs: number,
  ): PerformanceMetrics[] {
    const operationMetrics = this.metrics.get(operation) || [];
    const cutoff = Date.now() - timeWindowMs;
    return operationMetrics.filter((m) => m.timestamp > cutoff);
  }

  /**
   * Calculate average from sorted array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: any;
    operations: PerformanceStats[];
    alerts: PerformanceAlert[];
  } {
    return {
      summary: this.getHealthSummary(),
      operations: this.getAllStats(),
      alerts: this.getRecentAlerts(50),
    };
  }
}
