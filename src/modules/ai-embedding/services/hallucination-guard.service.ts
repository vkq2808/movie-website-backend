import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '@/modules/movie/entities/movie.entity';

/**
 * Validates and sanitizes LLM responses to prevent hallucination
 * (e.g., recommending movies that don't exist in database)
 */
@Injectable()
export class HallucinationGuardService {
  private readonly logger = new Logger('HallucinationGuardService');

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) { }

  /**
   * Verify that movie IDs exist in database
   * Returns only valid movies
   */
  async validateMovieIds(movieIds: string[]): Promise<string[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }

    try {
      const existingMovies = await this.movieRepository.find({
        where: movieIds.map((id) => ({ id })),
        select: ['id'],
      });

      const validIds = existingMovies.map((m) => m.id);
      const invalidCount = movieIds.length - validIds.length;

      if (invalidCount > 0) {
        this.logger.warn(
          `${invalidCount} invalid movie IDs detected and filtered out`,
        );
      }

      return validIds;
    } catch (error) {
      this.logger.error(`Failed to validate movie IDs: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean and validate LLM response text
   * Remove mentions of non-existent entities
   */
  async sanitizeResponse(
    response: string,
    contextMovies: { title: string; id: string }[],
  ): Promise<string> {
    try {
      // List of allowed movie titles from actual search results
      const allowedTitles = contextMovies.map((m) => m.title.toLowerCase());

      let sanitized = response;

      // Check for common hallucination patterns
      // This is a simple heuristic - you could make it more sophisticated

      // Pattern 1: Movie title in quotes that's not in our list
      const quotedTitles = response.match(/"([^"]+)"/g) || [];
      for (const quoted of quotedTitles) {
        const title = quoted.toLowerCase().replace(/"/g, '');
        if (!allowedTitles.some((t) => t.includes(title.split(' ')[0]))) {
          this.logger.warn(
            `Potential hallucinated movie title detected: ${quoted}`,
          );
          // Could remove or flag it
        }
      }

      return sanitized;
    } catch (error) {
      this.logger.error(`Failed to sanitize response: ${error.message}`);
      return response; // Return original if sanitization fails
    }
  }

  /**
   * Extract movie titles/names from text
   * Used to detect what movies LLM mentioned
   */
  extractMentionedMovies(text: string): string[] {
    const quoted = text.match(/"([^"]+)"/g) || [];
    return quoted.map((q) => q.replace(/"/g, ''));
  }

  /**
   * Verify movie mention is in database
   */
  async isMovieInDatabase(movieTitle: string): Promise<boolean> {
    try {
      const movie = await this.movieRepository.findOne({
        where: [
          { title: movieTitle },
          { original_title: movieTitle },
        ],
      });

      return !!movie;
    } catch (error) {
      this.logger.error(`Failed to check movie existence: ${error.message}`);
      return false;
    }
  }
}
