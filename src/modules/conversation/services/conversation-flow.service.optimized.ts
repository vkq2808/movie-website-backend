import { Injectable, Logger } from '@nestjs/common';
import { ConversationContextService } from './conversation-context.service';
import {
  IntentClassifierService,
  ConversationIntent,
} from './intent-classifier.service';
import { ResponseComposerService } from './response-composer.service';
import { RateLimitService } from './rate-limit.service';
import {
  BaseStrategy,
  StrategyInput,
  StrategyOutput,
} from '../strategies/base.strategy';
import { GreetingStrategy } from '../strategies/greeting.strategy';
import { SemanticSearchStrategy } from '../strategies/semantic-search.strategy';
import { RandomSuggestionStrategy } from '../strategies/random-suggestion.strategy';
import { FollowUpStrategy } from '../strategies/follow-up.strategy';
import { ComparisonStrategy } from '../strategies/comparison.strategy';
import { OffTopicStrategy } from '../strategies/off-topic.strategy';
import { ConversationContext } from './conversation-context.service';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { v4 as uuidv4 } from 'uuid';
import { PerformanceCacheService } from '@/modules/performance/performance-cache.service';
import { PerformanceMonitorService } from '@/modules/performance/performance-monitor.service';

/**
 * Optimized conversation flow service with parallel processing and caching
 */
@Injectable()
export class ConversationFlowServiceOptimized {
  private readonly logger = new Logger('ConversationFlowServiceOptimized');

  private readonly strategies: BaseStrategy[];

  constructor(
    private readonly contextService: ConversationContextService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly responseComposer: ResponseComposerService,
    private readonly rateLimitService: RateLimitService,
    private readonly greetingStrategy: GreetingStrategy,
    private readonly semanticSearchStrategy: SemanticSearchStrategy,
    private readonly randomSuggestionStrategy: RandomSuggestionStrategy,
    private readonly followUpStrategy: FollowUpStrategy,
    private readonly comparisonStrategy: ComparisonStrategy,
    private readonly offTopicStrategy: OffTopicStrategy,
    private readonly performanceCache: PerformanceCacheService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    this.strategies = [
      this.greetingStrategy,
      this.semanticSearchStrategy,
      this.randomSuggestionStrategy,
      this.followUpStrategy,
      this.comparisonStrategy,
      this.offTopicStrategy,
    ];
  }

  /**
   * Main orchestration method with performance optimizations
   */
  async process(
    message: string,
    sessionId?: string,
    userId?: string,
  ): Promise<{
    botMessage: { message: string };
    sessionId: string;
    suggestedKeywords: string[];
  }> {
    const startTime = Date.now();
    let operationDuration = 0;

    try {
      // 1) Determine session ID
      const finalSessionId = sessionId || this.generateSessionId();

      // 2) Check rate limiting
      if (this.rateLimitService.isRateLimited(finalSessionId)) {
        const remaining = this.rateLimitService.getRemainingRequests(finalSessionId);
        operationDuration = Date.now() - startTime;
        this.performanceMonitor.recordMetric('conversation_flow_rate_limited', operationDuration, {
          sessionId: finalSessionId,
          remainingRequests: remaining,
        });
        
        return {
          botMessage: {
            message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi một chút trước khi thử lại.',
          },
          sessionId: finalSessionId,
          suggestedKeywords: [],
        };
      }

      // 3) Load or create conversation context
      const context = await this.contextService.getOrCreate(finalSessionId, userId);

      // 4) Concurrent language detection and intent classification
      const [languageDetection, intentResult] = await Promise.all([
        this.detectLanguageWithCache(message),
        this.detectIntentWithCache(message, {
          lastIntent: context.lastIntent,
          suggestedMovieIds: context.suggestedMovieIds,
          messageHistory: context.messageHistory,
        }),
      ]);

      // 5) Select and execute strategy
      const strategy = this.selectStrategy(intentResult.intent);
      const strategyInput: StrategyInput = {
        message,
        intent: intentResult.intent,
        context,
        userPreferences: context.preferences,
        extractedEntities: intentResult.extractedEntities,
      };

      const strategyStartTime = Date.now();
      const strategyOutput: StrategyOutput = await strategy.execute(strategyInput);
      const strategyDuration = Date.now() - strategyStartTime;

      // 6) Compose final response
      const composeStartTime = Date.now();
      const finalText = await this.responseComposer.compose(
        intentResult.intent,
        strategyOutput.movies,
        strategyOutput.assistantText,
        context,
      );
      const composeDuration = Date.now() - composeStartTime;

      // 7) Update context
      this.updateContext(
        context,
        message,
        finalText,
        intentResult.intent,
        strategyOutput.movies,
      );

      // 8) Get follow-up keywords
      const suggestedKeywords =
        strategyOutput.followUpKeywords ||
        this.responseComposer.getFollowUpKeywords(
          intentResult.intent,
          context.language || 'vi',
          intentResult.extractedEntities,
        );

      operationDuration = Date.now() - startTime;

      // Record performance metrics
      this.performanceMonitor.recordMetric('conversation_flow_total', operationDuration, {
        sessionId: finalSessionId,
        userId,
        intent: intentResult.intent,
        strategy: strategy.constructor.name,
        strategyDuration,
        composeDuration,
        movieCount: strategyOutput.movies.length,
      });

      return {
        botMessage: { message: finalText },
        sessionId: finalSessionId,
        suggestedKeywords,
      };
    } catch (error) {
      operationDuration = Date.now() - startTime;
      this.performanceMonitor.recordError('conversation_flow_error', error as Error, {
        sessionId,
        userId,
      });

      this.logger.error('Conversation flow failed:', error);
      return {
        botMessage: {
          message: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
        },
        sessionId: sessionId || this.generateSessionId(),
        suggestedKeywords: ['gợi ý phim', 'phim mới', 'phim hay'],
      };
    }
  }

  /**
   * Enhanced language detection with caching
   */
  private async detectLanguageWithCache(message: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cachedResult = await this.performanceCache.getCachedLanguageResult(message);
      if (cachedResult) {
        this.performanceMonitor.recordMetric('language_detection_cached', Date.now() - startTime, {
          cacheHit: true,
        });
        return cachedResult;
      }

      // Perform actual detection
      const languageDetector = (this.intentClassifier as any).languageDetector;
      const result = await languageDetector.detectLanguage(message);

      // Cache the result
      await this.performanceCache.cacheLanguageResult(message, result);

      const duration = Date.now() - startTime;
      this.performanceMonitor.recordMetric('language_detection', duration, {
        cacheHit: false,
        detectedLanguage: result.language,
      });

      return result;
    } catch (error) {
      this.performanceMonitor.recordError('language_detection_error', error as Error, { message });
      throw error;
    }
  }

  /**
   * Enhanced intent classification with caching
   */
  private async detectIntentWithCache(
    message: string,
    context?: any,
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cachedResult = await this.performanceCache.getCachedIntentResult(message, context);
      if (cachedResult) {
        this.performanceMonitor.recordMetric('intent_classification_cached', Date.now() - startTime, {
          cacheHit: true,
        });
        return cachedResult;
      }

      // Perform actual classification
      const result = await this.intentClassifier.detectIntent(message, context);

      // Cache the result
      await this.performanceCache.cacheIntentResult(message, context, result);

      const duration = Date.now() - startTime;
      this.performanceMonitor.recordMetric('intent_classification', duration, {
        cacheHit: false,
        intent: result.intent,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      this.performanceMonitor.recordError('intent_classification_error', error as Error, { message });
      throw error;
    }
  }

  /**
   * Select appropriate strategy based on intent
   */
  private selectStrategy(intent: ConversationIntent): BaseStrategy {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(intent)) {
        return strategy;
      }
    }

    // Fallback to off-topic strategy
    return this.offTopicStrategy;
  }

  /**
   * Update conversation context with new message and response
   */
  private updateContext(
    context: ConversationContext,
    userMessage: string,
    assistantMessage: string,
    intent: ConversationIntent,
    movies: Movie[],
  ): void {
    // Add user message to history
    this.contextService.addMessage(context, 'user', userMessage);

    // Add assistant message to history
    this.contextService.addMessage(context, 'assistant', assistantMessage);

    // Update last intent
    context.lastIntent = intent;

    // Add suggested movies to context
    movies.forEach((movie) => {
      this.contextService.addSuggestedMovie(context, movie.id);
    });

    // Update context in storage
    this.contextService.update(context);
  }

  /**
   * Generate new session ID
   */
  private generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    return this.performanceMonitor.getAllStats();
  }

  /**
   * Get health summary
   */
  getHealthSummary(): any {
    return this.performanceMonitor.getHealthSummary();
  }

  /**
   * Clear performance metrics (for testing)
   */
  clearMetrics(): void {
    this.performanceMonitor.clearAllMetrics();
  }
}