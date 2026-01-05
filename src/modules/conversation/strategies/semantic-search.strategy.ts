import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { MovieEmbeddingService } from '@/modules/ai-embedding/services/movie-embedding.service';
import { TextPreprocessingService } from '@/modules/ai-embedding/services/text-preprocessing.service';
import { InputSanitizer } from '@/modules/ai-embedding/services/input-sanitizer.service';

@Injectable()
export class SemanticSearchStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.RECOMMENDATION;

  constructor(
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly inputSanitizer: InputSanitizer,
  ) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { message, context, userPreferences } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates(language);

    try {
      // 1) Sanitize and preprocess the message
      const sanitized = this.inputSanitizer.sanitizeUserInput(message);
      if (!sanitized.isValid) {
        return {
          movies: [],
          assistantText: templates.genericError,
        };
      }

      const normalized = this.textPreprocessing.preprocessForEmbedding(
        sanitized.sanitized,
      );
      if (!normalized || normalized.trim().length === 0) {
        return {
          movies: [],
          assistantText: templates.noResults,
        };
      }

      // 2) Semantic search with personalization
      const topK = 5;
      const similarityThreshold = 0.5;
      const results = await this.movieEmbeddingService.semanticSearch(
        normalized,
        topK,
        similarityThreshold,
      );

      if (!results || results.length === 0) {
        return {
          movies: [],
          assistantText: templates.noResults,
        };
      }

      // 3) Filter out already suggested movies
      const filteredResults = this.filterSuggestedMovies(
        results.map((r) => r.movie),
        context,
      );

      if (filteredResults.length === 0) {
        return {
          movies: [],
          assistantText:
            'Mình đã gợi ý hết các phim phù hợp rồi. Bạn muốn thử chủ đề khác không?',
        };
      }

      // 4) Update context with suggested movies
      filteredResults.forEach((movie) => {
        context.suggestedMovieIds.push(movie.id);
      });

      // 5) Generate assistant text
      const assistantText = this.generateRecommendationText(
        filteredResults,
        language,
      );

      // 6) Get follow-up keywords
      const followUpKeywords = this.getFollowUpKeywords(
        this.intent,
        language,
        input.context.lastIntent
          ? { keywords: [input.context.lastIntent] }
          : undefined,
      );

      return {
        movies: filteredResults,
        assistantText,
        followUpKeywords,
      };
    } catch (error) {
      this.logger.error('Semantic search failed:', error);
      return {
        movies: [],
        assistantText: templates.genericError,
      };
    }
  }

  /**
   * Generate friendly recommendation text
   */
  private generateRecommendationText(
    movies: Movie[],
    language: 'vi' | 'en',
  ): string {
    if (language === 'vi') {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `Mình gợi ý phim "${movie.title}" (${year}) - ${movie.overview?.substring(0, 100)}...`;
      } else {
        const movieList = movies
          .map((movie, index) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A';
            return `${index + 1}. ${movie.title} (${year})`;
          })
          .join(', ');
        return `Mình gợi ý các phim: ${movieList}. Bạn muốn xem thông tin chi tiết về phim nào không?`;
      }
    } else {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `I recommend "${movie.title}" (${year}) - ${movie.overview?.substring(0, 100)}...`;
      } else {
        const movieList = movies
          .map((movie, index) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A';
            return `${index + 1}. ${movie.title} (${year})`;
          })
          .join(', ');
        return `I recommend: ${movieList}. Would you like details about any of these movies?`;
      }
    }
  }
}
