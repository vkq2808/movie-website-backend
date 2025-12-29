import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Retry configuration for OpenAI API calls
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

/**
 * Handles retries with exponential backoff for OpenAI API calls
 */
@Injectable()
export class RetryService {
  private readonly logger = new Logger('RetryService');

  private readonly defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffFactor: 2,
  };

  constructor(private configService: ConfigService) { }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName: string,
    config?: Partial<RetryConfig>,
  ): Promise<T> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    let lastError: Error = new Error();
    let delay = mergedConfig.initialDelayMs;

    for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
      try {
        this.logger.debug(`${operationName} - Attempt ${attempt}`);
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === mergedConfig.maxRetries) {
          this.logger.error(
            `${operationName} failed after ${attempt} attempts: ${error.message}`,
          );
          throw error;
        }

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          this.logger.error(`${operationName} - Non-retryable error:`, error);
          throw error;
        }

        this.logger.warn(
          `${operationName} - Attempt ${attempt} failed, retrying in ${delay}ms`,
        );

        await this.delay(delay);

        // Exponential backoff
        delay = Math.min(
          delay * mergedConfig.backoffFactor,
          mergedConfig.maxDelayMs,
        );
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable (not 401, 403, etc.)
   */
  private isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Don't retry auth errors
    if (message.includes('401') || message.includes('invalid api key')) {
      return false;
    }

    // Don't retry permission errors
    if (message.includes('403') || message.includes('permission')) {
      return false;
    }

    // Retry rate limits, timeouts, and server errors
    return (
      message.includes('429') ||
      message.includes('500') ||
      message.includes('timeout') ||
      message.includes('temporarily unavailable')
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
