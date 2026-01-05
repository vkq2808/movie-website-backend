import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { MovieEmbeddingService } from '@/modules/ai-embedding/services/movie-embedding.service';
import { TextPreprocessingService } from '@/modules/ai-embedding/services/text-preprocessing.service';
import { InputSanitizer } from '@/modules/ai-embedding/services/input-sanitizer.service';

@Injectable()
export class FollowUpStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.FOLLOW_UP;

  constructor(
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly inputSanitizer: InputSanitizer,
  ) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { message, context } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates(language);

    try {
      // Check if we have suggested movies to follow up on
      if (context.suggestedMovieIds.length === 0) {
        // Fall back to semantic search
        return this.fallbackToSemanticSearch(input);
      }

      // Get the last suggested movies for follow-up
      const lastSuggestedIds = context.suggestedMovieIds.slice(-3);

      // Find similar movies to the last suggested ones
      const similarMovies: Movie[] = [];

      for (const movieId of lastSuggestedIds) {
        try {
          const similar =
            await this.movieEmbeddingService.getSimilarMoviesByMovieId(
              movieId,
              2, // Get 2 similar movies per suggested movie
            );

          similar.forEach((result) => {
            if (!context.suggestedMovieIds.includes(result.movie.id)) {
              similarMovies.push(result.movie);
            }
          });
        } catch (error) {
          this.logger.warn(
            `Failed to get similar movies for ${movieId}:`,
            error,
          );
        }
      }

      if (similarMovies.length === 0) {
        return this.fallbackToSemanticSearch(input);
      }

      // Filter out already suggested movies
      const filteredMovies = this.filterSuggestedMovies(similarMovies, context);

      if (filteredMovies.length === 0) {
        return {
          movies: [],
          assistantText:
            language === 'vi'
              ? 'Mình đã gợi ý hết các phim tương tự rồi. Bạn muốn thử chủ đề khác không?'
              : "I've suggested all similar movies. Would you like to try a different topic?",
        };
      }

      // Update context with new suggestions
      filteredMovies.forEach((movie) => {
        context.suggestedMovieIds.push(movie.id);
      });

      // Generate assistant text
      const assistantText = this.generateFollowUpText(filteredMovies, language);

      // Get follow-up keywords
      const followUpKeywords = this.getFollowUpKeywords(
        this.intent,
        language,
        input.context.lastIntent
          ? { keywords: [input.context.lastIntent] }
          : undefined,
      );

      return {
        movies: filteredMovies,
        assistantText,
        followUpKeywords,
      };
    } catch (error) {
      this.logger.error('Follow-up strategy failed:', error);
      return this.fallbackToSemanticSearch(input);
    }
  }

  /**
   * Fallback to semantic search when follow-up fails
   */
  private async fallbackToSemanticSearch(
    input: StrategyInput,
  ): Promise<StrategyOutput> {
    const { message, context } = input;
    const language = context.language || 'vi';

    // Reuse semantic search logic
    const sanitized = this.inputSanitizer.sanitizeUserInput(message);
    if (!sanitized.isValid) {
      return {
        movies: [],
        assistantText: this.getTemplates(language).genericError,
      };
    }

    const normalized = this.textPreprocessing.preprocessForEmbedding(
      sanitized.sanitized,
    );
    if (!normalized || normalized.trim().length === 0) {
      return {
        movies: [],
        assistantText: this.getTemplates(language).noResults,
      };
    }

    const results = await this.movieEmbeddingService.semanticSearch(
      normalized,
      5,
      0.5,
    );

    if (!results || results.length === 0) {
      return {
        movies: [],
        assistantText: this.getTemplates(language).noResults,
      };
    }

    const filteredResults = this.filterSuggestedMovies(
      results.map((r) => r.movie),
      context,
    );

    if (filteredResults.length === 0) {
      return {
        movies: [],
        assistantText:
          language === 'vi'
            ? 'Mình đã gợi ý hết các phim phù hợp rồi. Bạn muốn thử chủ đề khác không?'
            : "I've suggested all matching movies. Would you like to try a different topic?",
      };
    }

    filteredResults.forEach((movie) => {
      context.suggestedMovieIds.push(movie.id);
    });

    const assistantText = this.generateFollowUpText(filteredResults, language);
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
  }

  /**
   * Generate follow-up text
   */
  private generateFollowUpText(movies: Movie[], language: 'vi' | 'en'): string {
    if (language === 'vi') {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `Mình gợi ý thêm phim "${movie.title}" (${year}) - ${movie.overview?.substring(0, 100)}...`;
      } else {
        const movieList = movies
          .map((movie, index) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A';
            return `${index + 1}. ${movie.title} (${year})`;
          })
          .join(', ');
        return `Mình gợi ý thêm các phim: ${movieList}. Bạn muốn xem thông tin chi tiết về phim nào không?`;
      }
    } else {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `Here's another suggestion: "${movie.title}" (${year}) - ${movie.overview?.substring(0, 100)}...`;
      } else {
        const movieList = movies
          .map((movie, index) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A';
            return `${index + 1}. ${movie.title} (${year})`;
          })
          .join(', ');
        return `Here are some more suggestions: ${movieList}. Would you like details about any of these?`;
      }
    }
  }
}
