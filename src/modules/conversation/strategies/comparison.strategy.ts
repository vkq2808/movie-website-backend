import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ComparisonStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.COMPARISON;

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { message, context, extractedEntities } = input;

    const language = context.language || 'vi';
    const templates = this.getTemplates();

    try {
      // Extract movie names from entities or message
      const movieNames = this.extractMovieNames(message, extractedEntities);

      if (movieNames.length < 2) {
        return {
          movies: [],
          assistantText: 'Please provide at least 2 movies to compare.',
        };
      }

      // Find movies by name
      const movies = await this.findMoviesByName(movieNames);

      if (movies.length < 2) {
        return {
          movies: [],
          assistantText: 'Could not find enough movies to compare.',
        };
      }

      // Generate comparison text
      const assistantText = this.generateComparisonText(movies);

      // Get follow-up keywords
      const followUpKeywords = this.getFollowUpKeywords(
        this.intent,

        language,
        extractedEntities,
      );

      return {
        movies: movies.slice(0, 3), // Limit to 3 movies for comparison
        assistantText,
        followUpKeywords,
      };
    } catch (error) {
      this.logger.error('Comparison strategy failed:', error);
      return {
        movies: [],
        assistantText: templates.genericError,
      };
    }
  }

  /**
   * Extract movie names from message or entities
   */
  private extractMovieNames(
    message: string,
    extractedEntities?: any,
  ): string[] {
    const movieNames: string[] = [];

    // Use extracted entities if available
    if (extractedEntities?.movieNames?.length > 0) {
      return extractedEntities.movieNames;
    }

    // Simple pattern matching for movie names in quotes or after "so sánh"
    const patterns = [
      /["']([^"']+)["']/g,
      /so\s+sánh\s+([^,\s]+(?:\s+[^,\s]+)*)/gi,
      /compare\s+([^,\s]+(?:\s+[^,\s]+)*)/gi,
    ];

    for (const pattern of patterns) {
      const matches = message.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const name = match.replace(/["']/g, '').trim();
          if (name.length > 2 && !movieNames.includes(name)) {
            movieNames.push(name);
          }
        });
      }
    }

    return movieNames.slice(0, 3); // Limit to 3 movies
  }

  /**
   * Find movies by name (partial match)
   */
  private async findMoviesByName(movieNames: string[]): Promise<Movie[]> {
    const foundMovies: Movie[] = [];

    for (const name of movieNames) {
      const movie = await this.movieRepository
        .createQueryBuilder('movie')
        .where('LOWER(movie.title) LIKE LOWER(:name)', { name: `%${name}%` })
        .orWhere('LOWER(movie.original_title) LIKE LOWER(:name)', {
          name: `%${name}%`,
        })
        .andWhere('movie.status = :status', { status: 'public' })
        .orderBy('movie.vote_average', 'DESC')
        .getOne();

      if (movie && !foundMovies.find((m) => m.id === movie.id)) {
        foundMovies.push(movie);
      }
    }

    return foundMovies;
  }

  /**
   * Generate comparison text
   */
  private generateComparisonText(movies: Movie[]): string {
    const movieDetails = movies
      .map((movie, index) => {
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        const genres =
          movie.genres?.map((g) => g.names[0]?.name).join(', ') || 'N/A';
        const rating = movie.vote_average || 'N/A';
        return `${index + 1}. ${movie.title} (${year}) - Genres: ${genres}, Rating: ${rating}/10`;
      })
      .join('\n');

    return `Comparison of movies:\n${movieDetails}\n\nKey differences: ${this.getComparisonDifferences(movies)}`;
  }

  /**
   * Get comparison differences
   */
  private getComparisonDifferences(movies: Movie[]): string {
    const genres1 = new Set(
      movies[0].genres?.map((g) => g.names[0]?.name) || [],
    );
    const genres2 = new Set(
      movies[1].genres?.map((g) => g.names[0]?.name) || [],
    );

    const diffGenres = [...genres1].filter((g) => !genres2.has(g));
    const commonGenres = [...genres1].filter((g) => genres2.has(g));

    if (diffGenres.length > 0) {
      return `Movie 1 has unique genres: ${diffGenres.join(', ')}. Common genres: ${commonGenres.join(', ')}.`;
    } else {
      return `Both movies share the same genres. Differences in cast and director.`;
    }
  }
}
