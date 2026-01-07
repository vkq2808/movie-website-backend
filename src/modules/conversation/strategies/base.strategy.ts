import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { ConversationContext } from '../services/conversation-context.service';
import { ConversationIntent } from '../services/intent-classifier.service';

export interface StrategyInput {
  message: string;
  intent: ConversationIntent;
  context: ConversationContext;
  userPreferences?: {
    genres?: string[];
    actors?: string[];
  };
  extractedEntities?: {
    movieNames?: string[];
    keywords?: string[];
  };
}

export interface StrategyOutput {
  movies: Partial<Movie>[];
  assistantText: string;
  followUpKeywords?: string[];
}

@Injectable()
export abstract class BaseStrategy {
  protected readonly logger = new Logger(this.constructor.name);

  abstract readonly intent: ConversationIntent;

  abstract execute(input: StrategyInput): Promise<StrategyOutput>;

  /**
   * Check if strategy can handle the intent
   */
  canHandle(intent: ConversationIntent): boolean {
    return this.intent === intent;
  }

  /**
   * Get language-specific templates
   */
  protected getTemplates(language: 'vi' | 'en') {
    return {
      vi: {
        greeting:
          'Chào bạn! Mình là trợ lý xem phim của bạn. Bạn muốn mình giúp gì hôm nay?',
        noResults:
          'Xin lỗi, mình không tìm thấy phim nào phù hợp với yêu cầu của bạn.',
        genericError: 'Có lỗi xảy ra, vui lòng thử lại sau.',
      },
      en: {
        greeting: "Hello! I'm your movie assistant. How can I help you today?",
        noResults: "Sorry, I couldn't find any movies matching your request.",
        genericError: 'An error occurred, please try again later.',
      },
    }[language];
  }

  /**
   * Filter out already suggested movies
   */
  protected filterSuggestedMovies(
    movies: Partial<Movie>[],
    context: ConversationContext,
  ): Partial<Movie>[] {
    return movies.filter(
      (movie) =>
        !context.suggestedMovieIds.includes(movie?.id ?? '231231241283##!$!'),
    );
  }

  /**
   * Get follow-up keywords based on intent and language
   */
  protected getFollowUpKeywords(
    intent: ConversationIntent,
    language: 'vi' | 'en',
    extractedEntities?: any,
  ): string[] {
    const keywords = {
      vi: {
        [ConversationIntent.GREETING]: ['gợi ý phim', 'phim mới', 'phim hay'],
        [ConversationIntent.RECOMMENDATION]: [
          'xem thêm',
          'gợi ý khác',
          'phim tương tự',
        ],
        [ConversationIntent.RANDOM]: ['ngẫu nhiên', 'gợi ý khác', 'phim mới'],
        [ConversationIntent.FOLLOW_UP]: [
          'xem thêm',
          'gợi ý khác',
          'phim tương tự',
        ],
        [ConversationIntent.COMPARISON]: [
          'so sánh khác',
          'gợi ý phim',
          'phim tương tự',
        ],
      },
      en: {
        [ConversationIntent.GREETING]: [
          'suggest movies',
          'new movies',
          'good movies',
        ],
        [ConversationIntent.RECOMMENDATION]: [
          'see more',
          'other suggestions',
          'similar movies',
        ],
        [ConversationIntent.RANDOM]: [
          'random',
          'other suggestions',
          'new movies',
        ],
        [ConversationIntent.FOLLOW_UP]: [
          'see more',
          'other suggestions',
          'similar movies',
        ],
        [ConversationIntent.COMPARISON]: [
          'compare others',
          'suggest movies',
          'similar movies',
        ],
      },
    };

    const intentKeywords = keywords[language]?.[intent] || [];

    // Add entity-based keywords if available
    if (extractedEntities?.keywords?.length > 0) {
      return [...intentKeywords, ...extractedEntities.keywords].slice(0, 3);
    }

    return intentKeywords.slice(0, 3);
  }
}
