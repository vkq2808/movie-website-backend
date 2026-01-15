import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { MovieEmbeddingService } from '@/modules/ai-embedding/services/movie-embedding.service';
import { TextPreprocessingService } from '@/modules/ai-embedding/services/text-preprocessing.service';
import { InputSanitizer } from '@/modules/ai-embedding/services/input-sanitizer.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovieStatus } from '@/common/enums/movie-status.enum';

@Injectable()
export class SemanticSearchStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.RECOMMENDATION;

  constructor(
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly inputSanitizer: InputSanitizer,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { message, context, userPreferences, extractedEntities } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates();

    try {
      // 1) Build search query from expanded keywords (preferred) or original keywords
      const keywords = extractedEntities?.keywords || [];
      let searchQuery = '';

      if (keywords.length > 0) {
        // Use expanded keywords if available, join them into a natural query
        searchQuery = keywords.join(', ');
      } else {
        // Fallback: sanitize and preprocess the original message
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
        searchQuery = normalized;
      }

      // 2) Semantic search with embedding
      const topK = 8; // Request more to account for filtering
      const similarityThreshold = 0.5;

      let results: { movie: Partial<Movie>; similarity: number }[] = [];

      try {
        results = await this.movieEmbeddingService.semanticSearch(
          searchQuery,
          topK,
          similarityThreshold,
        );
      } catch (embeddingError) {
        this.logger.warn(
          'Embedding search failed, using fallback:',
          embeddingError,
        );
      }

      // 3) Filter movies: published status and not already suggested
      let filteredMovies = results
        .map((r) => r.movie)
        .filter((movie) => movie.status === MovieStatus.PUBLISHED);

      filteredMovies = this.filterSuggestedMovies(filteredMovies, context);

      // 4) Fallback: If we don't have enough results, add random movies
      const minResults = 3;
      if (filteredMovies.length < minResults) {
        const additionalNeeded = minResults - filteredMovies.length;
        const randomMovies = await this.getRandomMovies(additionalNeeded, [
          ...context.suggestedMovieIds,
          ...filteredMovies
            .filter((m) => m.id)
            .map((m) => m.id)
            .filter((id): id is string => id !== undefined),
        ]);
        filteredMovies = [...filteredMovies, ...randomMovies];
      }

      // 5) Limit to top results and remove duplicates
      filteredMovies = filteredMovies
        .filter(
          (movie, index, self) =>
            index === self.findIndex((m) => m.id === movie.id),
        )
        .slice(0, 5);

      if (filteredMovies.length === 0) {
        return {
          movies: [],
          assistantText: templates.noResults,
        };
      }

      // 6) Update context with suggested movies
      filteredMovies.forEach((movie) => {
        if (movie.id && !context.suggestedMovieIds.includes(movie.id)) {
          context.suggestedMovieIds.push(movie.id);
        }
      });

      // 7) Generate assistant text (will be enhanced by ResponseComposerService)
      const assistantText = '';

      // 8) Get follow-up keywords
      const followUpKeywords = this.getFollowUpKeywords(
        this.intent,
        language,
        extractedEntities,
      );

      return {
        movies: filteredMovies,
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
   * Get random movies as fallback when semantic search doesn't return enough results
   */
  private async getRandomMovies(
    limit: number,
    excludedIds: string[],
  ): Promise<Movie[]> {
    try {
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

      return await query.getMany();
    } catch (error) {
      this.logger.error('Failed to get random movies:', error);
      return [];
    }
  }

  /**
   * Generate narrative, analytical recommendation text
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
        const genres =
          movie.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const director =
          movie.crew?.find((c: any) => c.job === 'Director')?.person?.name ||
          '';

        return `Nếu bạn đang tìm một bộ phim ${genres ? genres + ' ' : ''}để thưởng thức, thì "${movie.title}" (${year}) là lựa chọn rất đáng cân nhắc. Phim mang đến ${movie.overview?.substring(0, 150) || 'một câu chuyện hấp dẫn'}...`;
      } else {
        const movie1 = movies[0];
        const movie2 = movies[1];
        const movie3 = movies.length > 2 ? movies[2] : null;

        const year1 = movie1.release_date
          ? new Date(movie1.release_date).getFullYear()
          : 'N/A';
        const year2 = movie2.release_date
          ? new Date(movie2.release_date).getFullYear()
          : 'N/A';
        const year3 = movie3?.release_date
          ? new Date(movie3.release_date).getFullYear()
          : 'N/A';

        const genres1 =
          movie1.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const genres2 =
          movie2.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const genres3 =
          movie3?.genres?.map((g) => g.names[0]?.name).join(', ') || '';

        let response = `Nếu bạn đang tìm những bộ phim ${genres1 || genres2 || genres3 ? 'đa dạng về thể loại' : 'hấp dẫn'} để khám phá, mình có vài gợi ý:\n\n`;

        response += `1. "${movie1.title}" (${year1}) - ${genres1 ? genres1 + ' ' : ''}mang đến ${movie1.overview?.substring(0, 120) || 'một trải nghiệm xem phim thú vị'}...\n\n`;
        response += `2. "${movie2.title}" (${year2}) - ${genres2 ? genres2 + ' ' : ''}khác biệt với ${movie2.overview?.substring(0, 120) || 'một phong cách riêng biệt'}...\n\n`;

        if (movie3) {
          response += `3. "${movie3.title}" (${year3}) - ${genres3 ? genres3 + ' ' : ''}đem đến ${movie3.overview?.substring(0, 120) || 'một góc nhìn mới mẻ'}...\n\n`;
        }

        response += `Tùy vào tâm trạng và thời gian rảnh, bạn có thể chọn phim phù hợp. Nếu bạn muốn, bạn có thể nói thêm về:\n- Thể loại bạn đang quan tâm\n- Tâm trạng muốn tìm kiếm\n- Thời gian xem phim`;

        return response;
      }
    } else {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        const genres =
          movie.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const director =
          movie.crew?.find((c: any) => c.job === 'Director')?.person?.name ||
          '';

        return `If you're looking for a ${genres ? genres + ' ' : ''}movie to enjoy, "${movie.title}" (${year}) is definitely worth considering. The film offers ${movie.overview?.substring(0, 150) || 'an engaging story'}...`;
      } else {
        const movie1 = movies[0];
        const movie2 = movies[1];
        const movie3 = movies.length > 2 ? movies[2] : null;

        const year1 = movie1.release_date
          ? new Date(movie1.release_date).getFullYear()
          : 'N/A';
        const year2 = movie2.release_date
          ? new Date(movie2.release_date).getFullYear()
          : 'N/A';
        const year3 = movie3?.release_date
          ? new Date(movie3.release_date).getFullYear()
          : 'N/A';

        const genres1 =
          movie1.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const genres2 =
          movie2.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const genres3 =
          movie3?.genres?.map((g) => g.names[0]?.name).join(', ') || '';

        let response = `If you're looking for diverse ${genres1 || genres2 || genres3 ? 'genre ' : ''}movies to explore, I have a few suggestions:\n\n`;

        response += `1. "${movie1.title}" (${year1}) - ${genres1 ? genres1 + ' ' : ''}offers ${movie1.overview?.substring(0, 120) || 'an interesting viewing experience'}...\n\n`;
        response += `2. "${movie2.title}" (${year2}) - ${genres2 ? genres2 + ' ' : ''}differs with ${movie2.overview?.substring(0, 120) || 'a unique style'}...\n\n`;

        if (movie3) {
          response += `3. "${movie3.title}" (${year3}) - ${genres3 ? genres3 + ' ' : ''}brings ${movie3.overview?.substring(0, 120) || 'a fresh perspective'}...\n\n`;
        }

        response += `Depending on your mood and available time, you can choose what fits best. If you'd like, you can tell me more about:\n- Genres you're interested in\n- The mood you're looking for\n- Your available viewing time`;

        return response;
      }
    }
  }
}
