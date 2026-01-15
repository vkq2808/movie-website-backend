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

@Injectable()
export class ConversationFlowService {
  private readonly logger = new Logger('ConversationFlowService');

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
   * Main orchestration method for conversation flow
   */
  async process(
    message: string,
    sessionId?: string,
    userId?: string,
  ): Promise<{
    botMessage: { message: string };
    sessionId: string;
    suggestedKeywords: string[];
    language?: 'vi' | 'en';
  }> {
    try {
      // 1) Determine session ID
      const finalSessionId = sessionId || this.generateSessionId();

      // 2) Check rate limiting
      if (this.rateLimitService.isRateLimited(finalSessionId)) {
        const remaining =
          this.rateLimitService.getRemainingRequests(finalSessionId);
        return {
          botMessage: {
            message:
              'You have sent too many requests. Please wait a moment before trying again.',
          },
          sessionId: finalSessionId,
          suggestedKeywords: [],
          language: 'vi',
        };
      }

      // 3) Load or create conversation context
      const context = await this.contextService.getOrCreate(
        finalSessionId,
        userId,
      );

      // 3) Detect intent
      const intentResult = await this.intentClassifier.detectIntent(message, {
        lastIntent: context.lastIntent,
        suggestedMovieIds: context.suggestedMovieIds,
        messageHistory: context.messageHistory,
      });

      // 4) Select and execute strategy
      const strategy = this.selectStrategy(intentResult.intent);
      const strategyInput: StrategyInput = {
        message,
        intent: intentResult.intent,
        context,
        userPreferences: context.preferences,
        extractedEntities: intentResult.extractedEntities,
      };

      const strategyOutput: StrategyOutput =
        await strategy.execute(strategyInput);

      // 5) Compose final response with user message context
      const finalText = await this.responseComposer.compose(
        intentResult.intent,
        strategyOutput.movies,
        strategyOutput.assistantText,
        context,
        message, // Pass user message for more personalized responses
      );

      // 6) Update context with analysis metadata
      this.updateContext(
        context,
        message,
        finalText,
        intentResult.intent,
        strategyOutput.movies,
        intentResult.extractedEntities,
      );

      // 7) Get follow-up keywords
      const suggestedKeywords =
        strategyOutput.followUpKeywords ||
        this.responseComposer.getFollowUpKeywords(
          intentResult.intent,
          context.language || 'vi',
          intentResult.extractedEntities,
        );

      return {
        botMessage: { message: finalText },
        sessionId: finalSessionId,
        suggestedKeywords,
        language: context.language || 'vi',
      };
    } catch (error) {
      this.logger.error('Conversation flow failed:', error);
      return {
        botMessage: {
          message: 'Sorry, an error occurred. Please try again later.',
        },
        sessionId: sessionId || this.generateSessionId(),
        suggestedKeywords: ['gợi ý phim', 'phim mới', 'phim hay'],
        language: 'vi',
      };
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
   * Enhanced to store analysis metadata (keywords, intent)
   */
  private updateContext(
    context: ConversationContext,
    userMessage: string,
    assistantMessage: string,
    intent: ConversationIntent,
    movies: Partial<Movie>[],
    extractedEntities?: { keywords?: string[] },
  ): void {
    // Add user message to history
    this.contextService.addMessage(context, 'user', userMessage);

    // Add assistant message to history
    this.contextService.addMessage(context, 'assistant', assistantMessage);

    // Update last intent
    context.lastIntent = intent;

    // Store used keywords for analytics
    if (extractedEntities?.keywords && extractedEntities.keywords.length > 0) {
      context.usedKeywords = extractedEntities.keywords;
    }

    // Determine response type
    if (movies.length > 0 && assistantMessage) {
      context.responseType = 'mixed';
    } else if (movies.length > 0) {
      context.responseType = 'movie';
    } else {
      context.responseType = 'text';
    }

    // Add suggested movies to context
    movies.forEach((movie) => {
      if (movie.id) this.contextService.addSuggestedMovie(context, movie.id);
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
}
