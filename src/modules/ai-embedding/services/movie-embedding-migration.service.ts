import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { MovieEmbeddingService } from './movie-embedding.service';

@Injectable()
export class MovieEmbeddingMigrationService {
  private readonly logger = new Logger('MovieEmbeddingMigrationService');

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly movieEmbeddingService: MovieEmbeddingService,
  ) { }

  /**
   * Bulk embed all movies that don't have embeddings yet
   * Called manually, not automatically
   */
  async migrateExistingMovies(): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    skipped: number;
  }> {
    try {
      const startTime = Date.now();
      this.logger.log('🚀 Starting bulk movie embedding migration...');

      // Get all movies
      const allMovies = await this.movieRepository.find({
        relations: ['genres', 'cast', 'crew', 'keywords'],
      });

      this.logger.log(`📊 Found ${allMovies.length} total movies`);

      if (allMovies.length === 0) {
        this.logger.warn('No movies found in database');
        return {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
        };
      }

      let successful = 0;
      let failed = 0;
      let skipped = 0;

      // Process each movie
      for (let i = 0; i < allMovies.length; i++) {
        const movie = allMovies[i];
        const progress = `[${i + 1}/${allMovies.length}]`;

        try {
          // Check if embedding already exists
          const hasEmbedding =
            await this.movieEmbeddingService.hasEmbedding(
              movie.id,
            );

          if (hasEmbedding) {
            this.logger.debug(
              `${progress} ⏭️  ${movie.title} - already has embedding`,
            );
            skipped++;
            continue;
          }

          // Create embedding
          const result = await this.movieEmbeddingService.embedMovie(
            movie.id,
          );

          if (result) {
            successful++;
            this.logger.log(
              `${progress} ✅ ${movie.title} - embedding created`,
            );
          } else {
            failed++;
            this.logger.warn(
              `${progress} ⚠️  ${movie.title} - embedding creation returned null`,
            );
          }

          // Add small delay to avoid rate limiting
          if ((i + 1) % 5 === 0) {
            this.logger.debug(`Processed ${i + 1} movies, pausing...`);
            await this.delay(1000);
          }
        } catch (error) {
          failed++;
          this.logger.error(
            `${progress} ❌ ${movie.title} - ${error.message}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

      const summary = {
        totalProcessed: allMovies.length,
        successful,
        failed,
        skipped,
        duration: `${duration}m`,
      };

      this.logger.log('═══════════════════════════════════════════');
      this.logger.log('📈 Bulk Embedding Migration Summary');
      this.logger.log('═══════════════════════════════════════════');
      this.logger.log(`Total Movies Processed: ${summary.totalProcessed}`);
      this.logger.log(`✅ Successfully Embedded: ${successful}`);
      this.logger.log(`⏭️  Already Had Embeddings: ${skipped}`);
      this.logger.log(`❌ Failed: ${failed}`);
      this.logger.log(`⏱️  Duration: ${summary.duration}`);
      this.logger.log('═══════════════════════════════════════════');

      return {
        totalProcessed: summary.totalProcessed,
        successful,
        failed,
        skipped,
      };
    } catch (error) {
      this.logger.error(
        `Migration failed with critical error: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Clear all embeddings (for testing/reset)
   */
  async clearAllEmbeddings(): Promise<{ deletedCount: number }> {
    try {
      this.logger.warn('⚠️  Clearing all embeddings...');

      const result = await this.movieRepository.query(
        'DELETE FROM movie_embedding',
      );

      this.logger.log(
        `🗑️  Deleted ${result.affectedRows || 'all'} embeddings`,
      );

      return {
        deletedCount: result.affectedRows || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to clear embeddings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get migration stats
   */
  async getStats(): Promise<{
    totalMovies: number;
    moviesWithEmbeddings: number;
    moviesWithoutEmbeddings: number;
    percentage: number;
  }> {
    try {
      const totalMovies = await this.movieRepository.count();

      const embeddedMovies = await this.movieRepository.query(
        `SELECT COUNT(DISTINCT movie_id) as count FROM movie_embedding`,
      );

      const withEmbeddings = embeddedMovies[0].count || 0;
      const withoutEmbeddings = totalMovies - withEmbeddings;
      const percentage =
        totalMovies > 0
          ? ((withEmbeddings / totalMovies) * 100).toFixed(2)
          : 0;

      return {
        totalMovies,
        moviesWithEmbeddings: withEmbeddings,
        moviesWithoutEmbeddings: withoutEmbeddings,
        percentage: parseFloat(percentage as string),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
