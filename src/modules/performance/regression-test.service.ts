import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '@/modules/chat/chat.service';
import { ConversationFlowService } from '@/modules/conversation/services/conversation-flow.service';
import { ConversationFlowServiceOptimized } from '@/modules/conversation/services/conversation-flow.service.optimized';
import { PerformanceMonitorService } from './performance-monitor.service';

/**
 * Test case interface
 */
interface TestCase {
  id: string;
  description: string;
  input: {
    message: string;
    sessionId?: string;
    userId?: string;
  };
  expected: {
    intent?: string;
    containsKeywords?: string[];
    minLength?: number;
    maxLength?: number;
  };
  priority: 'high' | 'medium' | 'low';
}

/**
 * Test result interface
 */
interface TestResult {
  testCase: TestCase;
  result: {
    success: boolean;
    response: any;
    duration: number;
    error?: string;
  };
  performance: {
    responseTime: number;
    memoryUsage?: number;
  };
  regression: {
    isRegression: boolean;
    threshold: number;
    actual: number;
  };
}

/**
 * Regression testing service
 * Ensures optimizations don't break existing functionality
 */
@Injectable()
export class RegressionTestService {
  private readonly logger = new Logger('RegressionTestService');

  private readonly testCases: TestCase[] = [
    // High priority test cases
    {
      id: 'greeting_vietnamese',
      description: 'Vietnamese greeting should work',
      input: { message: 'Xin chào' },
      expected: {
        containsKeywords: ['chào', 'hello', 'hi'],
      },
      priority: 'high',
    },
    {
      id: 'greeting_english',
      description: 'English greeting should work',
      input: { message: 'Hello' },
      expected: {
        containsKeywords: ['hello', 'hi', 'chào'],
      },
      priority: 'high',
    },
    {
      id: 'movie_recommendation_vietnamese',
      description: 'Vietnamese movie recommendation should work',
      input: { message: 'Gợi ý phim hành động' },
      expected: {
        containsKeywords: ['phim', 'hành động'],
        minLength: 50,
      },
      priority: 'high',
    },
    {
      id: 'movie_recommendation_english',
      description: 'English movie recommendation should work',
      input: { message: 'Recommend action movies' },
      expected: {
        containsKeywords: ['movie', 'action', 'film'],
        minLength: 50,
      },
      priority: 'high',
    },
    {
      id: 'random_suggestion',
      description: 'Random movie suggestion should work',
      input: { message: 'Gợi ý phim bất kỳ' },
      expected: {
        containsKeywords: ['phim'],
        minLength: 30,
      },
      priority: 'medium',
    },
    {
      id: 'comparison',
      description: 'Movie comparison should work',
      input: { message: 'So sánh phim The Matrix và Inception' },
      expected: {
        containsKeywords: ['so sánh', 'so sanh', 'compare'],
        minLength: 100,
      },
      priority: 'medium',
    },
    {
      id: 'off_topic',
      description: 'Off-topic should return appropriate response',
      input: { message: 'Thời tiết hôm nay thế nào?' },
      expected: {
        containsKeywords: ['không', 'không thể', 'không hỗ trợ'],
        minLength: 10,
      },
      priority: 'medium',
    },
    {
      id: 'farewell',
      description: 'Farewell should work',
      input: { message: 'Cảm ơn, tạm biệt' },
      expected: {
        containsKeywords: ['cảm ơn', 'tạm biệt', 'thank', 'bye'],
        minLength: 5,
      },
      priority: 'low',
    },
  ];

  constructor(
    private readonly chatService: ChatService,
    private readonly conversationFlow: ConversationFlowService,
    private readonly conversationFlowOptimized: ConversationFlowServiceOptimized,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Run all regression tests
   */
  async runAllTests(): Promise<{
    results: TestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      regressions: number;
      avgResponseTime: number;
    };
  }> {
    this.logger.log('Starting regression tests...');
    const startTime = Date.now();

    const results: TestResult[] = [];
    const responseTimes: number[] = [];

    for (const testCase of this.testCases) {
      const result = await this.runSingleTest(testCase);
      results.push(result);
      responseTimes.push(result.performance.responseTime);
    }

    const passed = results.filter((r) => r.result.success).length;
    const failed = results.filter((r) => !r.result.success).length;
    const regressions = results.filter((r) => r.regression.isRegression).length;
    const avgResponseTime =
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    const summary = {
      total: this.testCases.length,
      passed,
      failed,
      regressions,
      avgResponseTime,
    };

    const duration = Date.now() - startTime;
    this.logger.log(`Regression tests completed in ${duration}ms`, summary);

    return { results, summary };
  }

  /**
   * Run a single test case
   */
  private async runSingleTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();

    try {
      // Test the optimized service
      const response = await this.conversationFlowOptimized.process(
        testCase.input.message,
        testCase.input.sessionId,
        testCase.input.userId,
      );

      const duration = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();
      const memoryUsage = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Validate response
      const validationResult = this.validateResponse(
        response,
        testCase.expected,
      );

      // Check for performance regression
      const regressionCheck = this.checkPerformanceRegression(
        testCase,
        duration,
      );

      return {
        testCase,
        result: {
          success: validationResult.success,
          response: response,
          duration,
          error: validationResult.error,
        },
        performance: {
          responseTime: duration,
          memoryUsage,
        },
        regression: regressionCheck,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        testCase,
        result: {
          success: false,
          response: null,
          duration,
          error: error.message,
        },
        performance: {
          responseTime: duration,
        },
        regression: {
          isRegression: false,
          threshold: 0,
          actual: duration,
        },
      };
    }
  }

  /**
   * Validate response against expected criteria
   */
  private validateResponse(
    response: any,
    expected: TestCase['expected'],
  ): {
    success: boolean;
    error?: string;
  } {
    if (!response || !response.botMessage) {
      return { success: false, error: 'No response or botMessage' };
    }

    const message = response.botMessage.message;
    if (!message || typeof message !== 'string') {
      return { success: false, error: 'Invalid response format' };
    }

    // Check minimum length
    if (expected.minLength && message.length < expected.minLength) {
      return {
        success: false,
        error: `Response too short: ${message.length} < ${expected.minLength}`,
      };
    }

    // Check maximum length
    if (expected.maxLength && message.length > expected.maxLength) {
      return {
        success: false,
        error: `Response too long: ${message.length} > ${expected.maxLength}`,
      };
    }

    // Check required keywords
    if (expected.containsKeywords) {
      const lowerMessage = message.toLowerCase();
      const missingKeywords = expected.containsKeywords.filter(
        (keyword) => !lowerMessage.includes(keyword.toLowerCase()),
      );

      if (missingKeywords.length > 0) {
        return {
          success: false,
          error: `Missing keywords: ${missingKeywords.join(', ')}`,
        };
      }
    }

    return { success: true };
  }

  /**
   * Check for performance regression
   */
  private checkPerformanceRegression(
    testCase: TestCase,
    actualTime: number,
  ): {
    isRegression: boolean;
    threshold: number;
    actual: number;
  } {
    // Get historical performance data
    const stats = this.performanceMonitor.getStats(`conversation_flow_total`);

    if (!stats) {
      // No historical data, set conservative threshold
      const threshold = this.getDefaultThreshold(testCase.priority);
      return {
        isRegression: actualTime > threshold,
        threshold,
        actual: actualTime,
      };
    }

    // Use P95 as threshold with some buffer
    const threshold = stats.p95 * 1.5; // 50% buffer

    return {
      isRegression: actualTime > threshold,
      threshold,
      actual: actualTime,
    };
  }

  /**
   * Get default threshold based on test priority
   */
  private getDefaultThreshold(priority: string): number {
    switch (priority) {
      case 'high':
        return 3000; // 3 seconds
      case 'medium':
        return 5000; // 5 seconds
      case 'low':
        return 8000; // 8 seconds
      default:
        return 5000;
    }
  }

  /**
   * Run performance benchmark
   */
  async runBenchmark(iterations: number = 100): Promise<{
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
    throughput: number;
  }> {
    this.logger.log(`Running benchmark with ${iterations} iterations...`);

    const responseTimes: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const testStart = Date.now();
      await this.conversationFlowOptimized.process('Gợi ý phim hành động');
      const testDuration = Date.now() - testStart;
      responseTimes.push(testDuration);
    }

    const totalTime = Date.now() - startTime;
    responseTimes.sort((a, b) => a - b);

    return {
      avgResponseTime:
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: responseTimes[0],
      maxResponseTime: responseTimes[responseTimes.length - 1],
      p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      throughput: Math.round((iterations / totalTime) * 1000), // requests per second
    };
  }

  /**
   * Generate test report
   */
  generateReport(results: TestResult[]): string {
    const passed = results.filter((r) => r.result.success);
    const failed = results.filter((r) => !r.result.success);
    const regressions = results.filter((r) => r.regression.isRegression);

    let report = '# Regression Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += '## Summary\n\n';
    report += `- Total tests: ${results.length}\n`;
    report += `- Passed: ${passed.length}\n`;
    report += `- Failed: ${failed.length}\n`;
    report += `- Regressions: ${regressions.length}\n\n`;

    if (failed.length > 0) {
      report += '## Failed Tests\n\n';
      failed.forEach((result) => {
        report += `### ${result.testCase.id}: ${result.testCase.description}\n`;
        report += `**Input:** ${result.testCase.input.message}\n`;
        report += `**Error:** ${result.result.error}\n`;
        report += `**Duration:** ${result.performance.responseTime}ms\n\n`;
      });
    }

    if (regressions.length > 0) {
      report += '## Performance Regressions\n\n';
      regressions.forEach((result) => {
        report += `### ${result.testCase.id}: ${result.testCase.description}\n`;
        report += `**Threshold:** ${result.regression.threshold}ms\n`;
        report += `**Actual:** ${result.regression.actual}ms\n`;
        report += `**Overage:** ${result.regression.actual - result.regression.threshold}ms\n\n`;
      });
    }

    report += '## Performance Metrics\n\n';
    const avgTime =
      results.reduce((sum, r) => sum + r.performance.responseTime, 0) /
      results.length;
    report += `- Average response time: ${avgTime.toFixed(2)}ms\n`;
    report += `- Memory usage: ${results.reduce((sum, r) => sum + (r.performance.memoryUsage || 0), 0) / results.length} bytes\n`;

    return report;
  }

  /**
   * Get test cases for manual testing
   */
  getTestCases(): TestCase[] {
    return this.testCases;
  }
}
