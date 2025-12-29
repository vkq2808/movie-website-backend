import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { MovieEmbedding } from '../entities/movie-embedding.entity';
import { OpenAIService } from './openai.service';

@Injectable()
export class MovieEmbeddingService {
  private readonly logger = new Logger('MovieEmbeddingService');

  constructor(
    @InjectRepository(MovieEmbedding)
    private readonly movieEmbeddingRepository: Repository<MovieEmbedding>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly openaiService: OpenAIService,
  ) { }

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
  async embedMovie(movieId: string): Promise<MovieEmbedding | null> {
    try {
      // Check if embedding already exists
      const existingEmbedding =
        await this.movieEmbeddingRepository.findOne({
          where: { movie_id: movieId },
        });

      if (existingEmbedding) {
        this.logger.warn(
          `Embedding already exists for movie ${movieId}, skipping...`,
        );
        return existingEmbedding;
      }

      // Fetch movie with relations
      const movie = await this.movieRepository.findOne({
        where: { id: movieId },
        relations: ['genres', 'cast', 'crew', 'keywords'],
      });

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
      const movieEmbedding = this.movieEmbeddingRepository.create({
        movie_id: movieId,
        embedding: embeddingResponse.embedding,
        content: content,
        model: embeddingResponse.model,
        embedding_dimension: embeddingResponse.embedding.length,
      });

      const saved =
        await this.movieEmbeddingRepository.save(movieEmbedding);

      this.logger.log(
        `✅ Embedding created for movie ${movie.title} (${movieId})`,
      );

      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to embed movie ${movieId}: ${error.message}`,
      );

      // Don't throw - just log. This should not block movie creation
      return null;
    }
  }

  /**
   * Check if embedding exists for a movie
   */
  async hasEmbedding(movieId: string): Promise<boolean> {
    const count = await this.movieEmbeddingRepository.count({
      where: { movie_id: movieId },
    });
    return count > 0;
  }

  /**
   * Get embedding for a movie
   */
  async getEmbedding(movieId: string): Promise<MovieEmbedding | null> {
    return this.movieEmbeddingRepository.findOne({
      where: { movie_id: movieId },
      relations: ['movie'],
    });
  }

  /**
   * Search for movies similar to query text
   * Returns top K most similar movies
   */
  async semanticSearch(
    queryText: string,
    topK: number = 5,
    similarityThreshold: number = 0.5,
  ): Promise<{ movie: Movie; similarity: number }[]> {
    try {
      this.logger.debug(`Semantic search for: "${queryText}", topK: ${topK}`);

      // Create embedding for query
      const queryEmbedding = await this.openaiService.createEmbedding(
        queryText,
        'text-embedding-3-large',
      );

      // Get all embeddings
      const allEmbeddings = await this.movieEmbeddingRepository.find({
        relations: ['movie'],
      });

      if (!allEmbeddings || allEmbeddings.length === 0) {
        this.logger.warn('No movie embeddings found in database');
        return [];
      }

      // Calculate similarity for each embedding
      const similarities = allEmbeddings
        .map((emb) => ({
          movie: emb.movie,
          similarity: this.openaiService.cosineSimilarity(
            queryEmbedding.embedding,
            emb.embedding,
          ),
        }))
        .filter((result) => result.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      this.logger.debug(
        `Found ${similarities.length} similar movies (threshold: ${similarityThreshold})`,
      );

      return similarities;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`);
      throw error;
    }
  }
}
