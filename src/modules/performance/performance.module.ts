import { Module } from '@nestjs/common';
import { PerformanceCacheService } from './performance-cache.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { RegressionTestService } from './regression-test.service';

@Module({
  providers: [
    PerformanceCacheService,
    PerformanceMonitorService,
    RegressionTestService,
  ],
  exports: [
    PerformanceCacheService,
    PerformanceMonitorService,
    RegressionTestService,
  ],
})
export class PerformanceModule {}
