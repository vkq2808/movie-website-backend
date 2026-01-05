import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovieStatus } from '@/common/enums/movie-status.enum';

@Injectable()
export class RandomSuggestionStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.RANDOM;

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { context } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates(language);

    try {
      // Get random movies excluding already suggested ones
      const excludedIds = context.suggestedMovieIds;
      const limit = 5;

      let query = this.movieRepository
        .createQueryBuilder('movie')
        .where('movie.status = :status', { status: MovieStatus.PUBLISHED })
        .orderBy('RANDOM()')
        .limit(limit);

      if (excludedIds.length > 0) {
        query = query.andWhere('movie.id NOT IN (:...excludedIds)', {
          excludedIds,
        });
      }

      const randomMovies = await query.getMany();

      if (randomMovies.length === 0) {
        return {
          movies: [],
          assistantText: 'Xin lỗi, hiện tại không có phim nào để gợi ý.',
        };
      }

      // Update context with suggested movies
      randomMovies.forEach((movie) => {
        context.suggestedMovieIds.push(movie.id);
      });

      // Generate assistant text
      const assistantText = this.generateRandomText(randomMovies, language);

      // Get follow-up keywords
      const followUpKeywords = this.getFollowUpKeywords(
        this.intent,
        language,
        input.context.lastIntent
          ? { keywords: [input.context.lastIntent] }
          : undefined,
      );

      return {
        movies: randomMovies,
        assistantText,
        followUpKeywords,
      };
    } catch (error) {
      this.logger.error('Random suggestion failed:', error);
      return {
        movies: [],
        assistantText: templates.genericError,
      };
    }
  }

  /**
   * Generate random suggestion text
   */
  private generateRandomText(movies: Movie[], language: 'vi' | 'en'): string {
    if (language === 'vi') {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `Mình gợi ý ngẫu nhiên phim "${movie.title}" (${year}) - ${movie.overview?.substring(0, 100)}...`;
      } else {
        const movieList = movies
          .map((movie, index) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A';
            return `${index + 1}. ${movie.title} (${year})`;
          })
          .join(', ');
        return `Mình gợi ý ngẫu nhiên các phim: ${movieList}. Bạn thích phim nào không?`;
      }
    } else {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `Here's a random suggestion: "${movie.title}" (${year}) - ${movie.overview?.substring(0, 100)}...`;
      } else {
        const movieList = movies
          .map((movie, index) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A';
            return `${index + 1}. ${movie.title} (${year})`;
          })
          .join(', ');
        return `Here are some random suggestions: ${movieList}. Which one interests you?`;
      }
    }
  }
}
