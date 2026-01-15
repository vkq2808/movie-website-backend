import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { MovieEmbeddingService } from './movie-embedding.service';

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_DELAY_MS = 500;
const DEFAULT_CONCURRENCY = 1;

@Injectable()
export class MovieEmbeddingMigrationService {
  private readonly logger = new Logger('MovieEmbeddingMigrationService');

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly dataSource: DataSource,
  ) {
    // this.migrateExistingMovies();
  }

  /**
   * Bulk embed all movies that don't have embeddings yet
   * Called manually, not automatically
   */
  /**
   * Migrate embeddings with safe batching and memory hygiene.
   * Options:
   *  - batchSize: number of movies per batch (default: 50)
   *  - delayMs: wait between batches in ms (default: 500)
   *  - concurrency: how many movies to process in parallel within a batch (default: 1)
   *  - dryRun: don't actually create embeddings, just report (default: false)
   *  - resume: skip movies that already have embeddings (default: true)
   */
  async migrateExistingMovies(options?: {
    batchSize?: number;
    delayMs?: number;
    concurrency?: number;
    dryRun?: boolean;
    resume?: boolean;
  }): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    skipped: number;
  }> {
    const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const concurrency = Math.max(
      1,
      Math.floor(options?.concurrency ?? DEFAULT_CONCURRENCY),
    );
    const dryRun = options?.dryRun ?? false;
    const resume = options?.resume ?? true;

    const startTime = Date.now();
    this.logger.log(
      `🚀 Starting bulk movie embedding migration (batchSize=${batchSize}, concurrency=${concurrency}, dryRun=${dryRun})`,
    );

    let lastId: string | null = null;
    let batchIndex = 0;

    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const memoryUsage = () => {
      const mu = process.memoryUsage();
      return `heapUsed=${Math.round(mu.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(mu.heapTotal / 1024 / 1024)}MB`;
    };

    // helper for limited concurrency
    const asyncPool = async <T, R>(
      poolLimit: number,
      array: T[],
      iteratorFn: (item: T, index: number) => Promise<R>,
    ) => {
      const ret: R[] = [];
      const executing: Promise<void>[] = [];
      for (let i = 0; i < array.length; i++) {
        const p = (async () => {
          const res = await iteratorFn(array[i], i);
          ret.push(res as unknown as R);
        })();
        executing.push(p.then(() => {}));
        if (executing.length >= poolLimit) {
          await Promise.race(executing);
          // remove settled promises
          for (let j = executing.length - 1; j >= 0; j--) {
            if ((executing[j] as any).isFulfilled) executing.splice(j, 1);
          }
          // fallback: trim array to keep size small
          if (executing.length > poolLimit * 2)
            executing.splice(0, executing.length - poolLimit);
        }
      }
      await Promise.all(executing);
      return ret;
    };

    while (true) {
      batchIndex++;

      // Only select minimal fields to avoid loading large relations in memory
      // include `overview` as it's used for embedding content construction
      let movies = await this.movieRepository
        .createQueryBuilder('movie')
        .select(['movie.id', 'movie.title', 'movie.overview'])
        .where(lastId ? 'movie.id > :lastId' : '1=1', { lastId })
        .orderBy('movie.id', 'ASC')
        .limit(batchSize)
        .getMany();

      if (!movies || movies.length === 0) break;

      this.logger.log(
        `[EmbeddingMigration] Batch ${batchIndex} started (${movies.length} movies) - ${memoryUsage()}`,
      );

      const processMovie = async (movie: Movie, indexInBatch: number) => {
        totalProcessed++;
        const progress = `Batch:${batchIndex}#${indexInBatch + 1} (global:${totalProcessed})`;
        try {
          // keep a local mutable reference so we can null it explicitly
          let movieRef: any = movie;

          if (resume) {
            const hasEmbedding = await this.movieEmbeddingService.hasEmbedding(
              movieRef.id,
            );
            if (hasEmbedding) {
              skipped++;
              this.logger.debug(
                `${progress} ⏭️  ${movieRef.title} - already has embedding`,
              );
              // release ref
              movieRef = null;
              this.logger.debug(
                `${progress} – memory cleaned - ${memoryUsage()}`,
              );
              return;
            }
          }

          if (dryRun) {
            this.logger.debug(
              `${progress} [dry-run] would embed ${movieRef.title}`,
            );
            movieRef = null;
            this.logger.debug(
              `${progress} – memory cleaned - ${memoryUsage()}`,
            );
            return;
          }

          // Call embedding service which will fetch relations and persist the embedding.
          // We intentionally pass only movie.id so we don't carry the movie object or relations in this scope.
          await this.movieEmbeddingService.embedMovie(movieRef.id);

          successful++;
          this.logger.log(
            `${progress} ✅ ${movieRef.title} - embedding created`,
          );

          // explicitly null local variables so they can be GC'd immediately
          movieRef = null;

          // log memory snapshot after cleanup for verification
          this.logger.debug(`${progress} – memory cleaned - ${memoryUsage()}`);
        } catch (error) {
          failed++;
          this.logger.error(
            `${progress} ❌ ${movie.title} - ${error?.message || error}`,
          );
        }
      };

      if (concurrency <= 1) {
        for (let i = 0; i < movies.length; i++) {
          // sequential processing keeps memory low
          // eslint-disable-next-line no-await-in-loop
          await processMovie(movies[i], i);
        }
      } else {
        // limited concurrency: use a worker pool that does not retain results
        let idx = 0;
        const workerCount = Math.min(concurrency, movies.length);
        const workers: Promise<void>[] = new Array(workerCount)
          .fill(null)
          .map(async () => {
            while (true) {
              const i = idx++;
              if (i >= movies.length) break;
              // process and ensure no result is captured
              // eslint-disable-next-line no-await-in-loop
              await processMovie(movies[i], i);
            }
          });

        await Promise.all(workers);
      }

      // update cursor (last id in batch)
      lastId = movies[movies.length - 1].id;

      // Explicitly release references for the batch so GC can reclaim memory
      movies.length = 0;
      // @ts-ignore
      movies = null;

      this.logger.log(
        `[EmbeddingMigration] Batch ${batchIndex} completed - ${memoryUsage()}`,
      );

      // small delay between batches to reduce pressure on DB / API
      // eslint-disable-next-line no-await-in-loop
      await this.delay(delayMs);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    this.logger.log('══════════════════════════════════════');
    this.logger.log('📈 Bulk Embedding Migration Summary');
    this.logger.log(`Total Processed: ${totalProcessed}`);
    this.logger.log(`✅ Success: ${successful}`);
    this.logger.log(`⏭️  Skipped: ${skipped}`);
    this.logger.log(`❌ Failed: ${failed}`);
    this.logger.log(`⏱️  Duration: ${duration}m`);
    this.logger.log('══════════════════════════════════════');

    return {
      totalProcessed,
      successful,
      failed,
      skipped,
    };
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

      this.logger.log(`🗑️  Deleted ${result.affectedRows || 'all'} embeddings`);

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
        totalMovies > 0 ? ((withEmbeddings / totalMovies) * 100).toFixed(2) : 0;

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
