import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { MovieCast } from '@/modules/movie/entities/movie-cast.entity';
import { MovieCrew } from '@/modules/movie/entities/movie-crew.entity';
import { MovieEmbedding } from '../entities/movie-embedding.entity';
import { OpenAIService } from './openai.service';

const toPgVectorLiteral = (vec: number[]): string => {
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error('Invalid embedding vector');
  }

  // pgvector yêu cầu [1,2,3] chứ KHÔNG phải {1,2,3}
  return `[${vec.join(',')}]`;
};

@Injectable()
export class MovieEmbeddingService {
  private readonly logger = new Logger('MovieEmbeddingService');

  constructor(
    @InjectRepository(MovieEmbedding)
    private readonly movieEmbeddingRepository: Repository<MovieEmbedding>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(MovieCast)
    private readonly movieCastRepository: Repository<MovieCast>,
    @InjectRepository(MovieCrew)
    private readonly movieCrewRepository: Repository<MovieCrew>,
    private readonly openaiService: OpenAIService,
  ) {}

  /**
   * Build normalized text content from movie data
   * This text will be used for semantic embedding
   */
  private buildNormalizedContent(movie: Movie): string {
    const parts: string[] = [];

    // Movie title
    if (movie.title) {
      parts.push(`Movie title: ${movie.title}.`);
    }

    // Original title
    if (movie.original_title && movie.original_title !== movie.title) {
      parts.push(`Original title: ${movie.original_title}.`);
    }

    // Genres
    if (movie.genres && movie.genres.length > 0) {
      const genreNames = movie.genres.map((g: any) => g.name).join(', ');
      parts.push(`Genres: ${genreNames}.`);
    }

    // Overview / Synopsis
    if (movie.overview) {
      parts.push(`Overview: ${movie.overview}`);
    }

    // Cast (if loaded)
    if (movie.cast && movie.cast.length > 0) {
      const actorNames = movie.cast
        .filter((c: any) => c.name)
        .slice(0, 5)
        .map((c: any) => c.name)
        .join(', ');
      if (actorNames) {
        parts.push(`Actors: ${actorNames}.`);
      }
    }

    // Crew - Director
    if (movie.crew && movie.crew.length > 0) {
      const directors = movie.crew
        .filter((c: any) => c.job === 'Director')
        .slice(0, 2)
        .map((c: any) => c.name)
        .join(', ');
      if (directors) {
        parts.push(`Director: ${directors}.`);
      }
    }

    // Release year
    if (movie.release_date) {
      const year = new Date(movie.release_date).getFullYear();
      parts.push(`Release year: ${year}.`);
    }

    // Rating
    if (movie.vote_average && movie.vote_average > 0) {
      parts.push(`Rating: ${movie.vote_average}/10.`);
    }

    // Keywords
    if (movie.keywords && movie.keywords.length > 0) {
      const keywordNames = movie.keywords
        .slice(0, 10)
        .map((k: any) => k.name)
        .join(', ');
      if (keywordNames) {
        parts.push(`Keywords: ${keywordNames}.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Create or update embedding for a single movie
   * This is called after movie creation
   */
  async embedMovie(movieId: string) {
    try {
      if (!movieId || movieId.trim().length === 0) {
        this.logger.error('Invalid movie ID');
        throw new Error('Invalid movie ID');
      }

      // Check if embedding already exists
      const existingEmbedding = await this.getEmbedding(movieId);

      if (existingEmbedding) {
        this.logger.warn(
          `Embedding already exists for movie ${movieId}, skipping...`,
        );
        return existingEmbedding;
      }

      // Fetch movie with only small/eager relations (avoid loading full cast/crew arrays)
      const movie = await this.movieRepository.findOne({
        where: { id: movieId },
        relations: ['genres', 'keywords'],
      });

      // Load only top N cast and crew ordered by popularity to reduce memory pressure
      const TOP_CAST = 10;
      const TOP_CREW = 10;

      const cast = await this.movieCastRepository
        .createQueryBuilder('mc')
        .where('mc.movie_id = :movieId', { movieId })
        .orderBy('mc.popularity', 'DESC')
        .limit(TOP_CAST)
        .getMany();

      const crew = await this.movieCrewRepository
        .createQueryBuilder('mc')
        .where('mc.movie_id = :movieId', { movieId })
        .orderBy('mc.popularity', 'DESC')
        .limit(TOP_CREW)
        .getMany();

      // attach limited lists so downstream logic only sees the top entries
      // @ts-ignore
      movie.cast = cast;
      // @ts-ignore
      movie.crew = crew;

      if (!movie) {
        throw new Error(`Movie with ID ${movieId} not found`);
      }

      this.logger.debug(
        `Starting embedding for movie: ${movie.title} (${movie.id})`,
      );

      // Build normalized content
      const content = this.buildNormalizedContent(movie);

      if (!content || content.trim().length === 0) {
        throw new Error(`Cannot create embedding for empty movie content`);
      }

      // Call OpenAI to create embedding
      const embeddingResponse = await this.openaiService.createEmbedding(
        content,
        'text-embedding-3-large',
      );

      // Save to database
      await this.movieEmbeddingRepository.query(
        `
  INSERT INTO movie_embedding (
    movie_id,
    embedding,
    content,
    model,
    embedding_dimension
  )
  VALUES (
    $1,
    $2::vector,
    $3,
    $4,
    $5
  )
  `,
        [
          movie.id,
          toPgVectorLiteral(embeddingResponse.embedding), // ✅ FIX
          content,
          embeddingResponse.model,
          embeddingResponse.embedding.length,
        ],
      );

      this.logger.log(
        `✅ Embedding created for movie ${movie.title} (${movieId})`,
      );
    } catch (error) {
      this.logger.error(`Failed to embed movie ${movieId}: ${error.message}`);

      // Don't throw - just log. This should not block movie creation
      return null;
    }
  }

  /**
   * Check if embedding exists for a movie
   */
  async hasEmbedding(movieId: string): Promise<boolean> {
    const exists = await this.movieEmbeddingRepository
      .createQueryBuilder('me')
      .where('me.movie_id = :movieId', { movieId })
      .getExists();

    return exists;
  }

  /**
   * Get embedding for a movie
   */
  async getEmbedding(movieId: string): Promise<any | null> {
    return this.movieEmbeddingRepository
      .createQueryBuilder('me')
      .where('me.movie_id = :movieId', { movieId })
      .getOne();
  }

  /**
   * Search for movies similar to query text using database-level vector similarity
   * CRITICAL: This method eliminates in-memory vector search to prevent OOM crashes
   * Returns top K most similar movies with minimal memory footprint
   */
  async semanticSearch(
    queryText: string,
    topK: number = 5,
    similarityThreshold: number = 0.8,
  ): Promise<{ movie: Partial<Movie>; similarity: number }[]> {
    try {
      this.logger.debug(`Semantic search for: "${queryText}", topK: ${topK}`);

      // 1️⃣ Create embedding for query
      const queryEmbedding = await this.openaiService.createEmbedding(
        queryText,
        'text-embedding-3-large',
      );

      // // 2️⃣ Serialize embedding to pgvector literal
      // const toPgVector = (vec: number[]): string => {
      //   if (!Array.isArray(vec) || vec.length === 0) {
      //     throw new Error('Invalid embedding vector');
      //   }
      //   return JSON.stringify(vec); // "[0.1,0.2,...]"
      // };

      // 3️⃣ Build cosine similarity SQL (NO inline data)
      const buildCosineSimilarityQuery = (
        column: string,
        paramName: string,
      ): string => {
        return `1 - (${column} <=> (:${paramName})::vector)`;
      };

      const similarityExpr = buildCosineSimilarityQuery(
        'me.embedding',
        'queryEmbedding',
      );

      // 4️⃣ Query using database-level vector similarity
      const results = await this.movieEmbeddingRepository
        .createQueryBuilder('me')
        .leftJoin('me.movie', 'movie')
        .select([
          'movie.id as movie_id',
          'movie.title as movie_title',
          'movie.overview as movie_overview',
          'movie.release_date as movie_release_date',
          'movie.vote_average as movie_vote_average',
          `${similarityExpr} as similarity`,
          'movie.posters as posters',
          'movie.backdrops as backdrops',
        ])
        .where(`${similarityExpr} >= :threshold`)
        .setParameters({
          queryEmbedding: toPgVectorLiteral(queryEmbedding.embedding),
          threshold: similarityThreshold,
        })
        .orderBy('similarity', 'DESC')
        .limit(topK)
        .getRawMany();

      // 5️⃣ Map to output format (minimal memory usage)
      const similarities = results.map((row: any) => ({
        movie: {
          id: row.movie_id,
          title: row.movie_title,
          overview: row.movie_overview,
          release_date: row.movie_release_date,
          vote_average: row.movie_vote_average,
          posters: row.posters,
          backdrops: row.backdrops,
        } as Partial<Movie>,
        similarity: Number(row.similarity),
      }));

      this.logger.debug(
        `Found ${similarities.length} similar movies (threshold: ${similarityThreshold})`,
      );

      return similarities;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get similar movies to a given movie by its ID using database-level similarity
   * CRITICAL: This method eliminates in-memory vector search to prevent OOM crashes
   */
  async getSimilarMoviesByMovieId(
    movieId: string,
    topK: number = 5,
    similarityThreshold: number = 0.5,
  ): Promise<{ movie: Partial<Movie>; similarity: number }[]> {
    try {
      this.logger.debug(
        `Finding similar movies for movie ID: ${movieId}, topK: ${topK}`,
      );

      // Get the movie's embedding
      const movieEmbedding = await this.getEmbedding(movieId);

      if (!movieEmbedding) {
        this.logger.warn(`No embedding found for movie ${movieId}`);
        return [];
      }

      // CRITICAL: Use database-level vector similarity instead of loading all embeddings
      // This prevents loading ALL movie embeddings into Node.js heap
      const results = await this.movieEmbeddingRepository
        .createQueryBuilder('me')
        .leftJoinAndSelect('me.movie', 'movie')
        .select([
          'movie.id',
          'movie.title',
          'movie.overview',
          'movie.release_date',
          'movie.vote_average',
          // Calculate similarity in database to avoid loading embeddings into memory
          `(${this.buildCosineSimilarityQuery('me.embedding', movieEmbedding.embedding)}) as similarity`,
        ])
        .where('me.movie_id != :targetMovieId', { targetMovieId: movieId })
        .andWhere(
          `(${this.buildCosineSimilarityQuery('me.embedding', movieEmbedding.embedding)}) >= :threshold`,
          { threshold: similarityThreshold },
        )
        .orderBy('similarity', 'DESC')
        .limit(topK)
        .getRawMany();

      // Convert results to expected format with minimal memory usage
      const similarities = results.map((result: any) => ({
        movie: {
          id: (result.movie_id as string) ?? '',
          title: result.movie_title,
          overview: result.movie_overview,
          release_date: result.movie_release_date,
          vote_average: result.movie_vote_average,
        } as Partial<Movie>,
        similarity: parseFloat(result.similarity),
      }));

      this.logger.debug(
        `Found ${similarities.length} similar movies to ${movieId} (threshold: ${similarityThreshold})`,
      );

      return similarities;
    } catch (error) {
      this.logger.error(
        `Failed to find similar movies for ${movieId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Build cosine similarity query for database-level calculation
   * This prevents loading embeddings into Node.js memory
   */
  private buildCosineSimilarityQuery(
    embeddingColumn: string,
    queryEmbedding: number[],
  ): string {
    // Convert embedding array to PostgreSQL array format
    const embeddingArray = `{${queryEmbedding.join(',')}}`;

    // Use PostgreSQL's built-in vector operations for cosine similarity
    // This calculates similarity entirely in the database without loading embeddings into memory
    return `
      (
        ${embeddingColumn} <-> '${embeddingArray}'::vector
      ) * -1 + 1
    `;
  }
}
