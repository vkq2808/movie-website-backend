import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { MovieEmbeddingService } from '@/modules/ai-embedding/services/movie-embedding.service';
import { TextPreprocessingService } from '@/modules/ai-embedding/services/text-preprocessing.service';
import { InputSanitizer } from '@/modules/ai-embedding/services/input-sanitizer.service';
import { PerformanceCacheService } from '@/modules/performance/performance-cache.service';
import { PerformanceMonitorService } from '@/modules/performance/performance-monitor.service';

/**
 * Optimized semantic search strategy with caching and performance monitoring
 */
@Injectable()
export class SemanticSearchStrategyOptimized extends BaseStrategy {
  readonly intent = ConversationIntent.RECOMMENDATION;

  constructor(
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly inputSanitizer: InputSanitizer,
    private readonly performanceCache: PerformanceCacheService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { message, context, userPreferences } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates(language);
    const startTime = Date.now();

    try {
      // 1) Sanitize and preprocess the message
      const sanitized = this.inputSanitizer.sanitizeUserInput(message);
      if (!sanitized.isValid) {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'semantic_search_invalid_input',
          duration,
          {
            sessionId: context.sessionId,
            language,
          },
        );

        return {
          movies: [],
          assistantText: templates.genericError,
        };
      }

      const normalized = this.textPreprocessing.preprocessForEmbedding(
        sanitized.sanitized,
      );
      if (!normalized || normalized.trim().length === 0) {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'semantic_search_empty_input',
          duration,
          {
            sessionId: context.sessionId,
            language,
          },
        );

        return {
          movies: [],
          assistantText: templates.noResults,
        };
      }

      // 2) Check cache for similar semantic search results
      const topK = 5;
      const similarityThreshold = 0.5;
      const cacheKey = this.generateSearchCacheKey(
        normalized,
        topK,
        similarityThreshold,
      );

      let results = await this.performanceCache.getCachedSemanticSearchResult(
        normalized,
        topK,
        similarityThreshold,
      );

      let cacheHit = false;
      let embeddingDuration = 0;

      if (results) {
        cacheHit = true;
        this.performanceMonitor.recordMetric('semantic_search_cached', 0, {
          sessionId: context.sessionId,
          language,
          cacheHit: true,
        });
      } else {
        // 3) Perform semantic search with performance monitoring
        const searchStartTime = Date.now();
        results = await this.movieEmbeddingService.semanticSearch(
          normalized,
          topK,
          similarityThreshold,
        );
        embeddingDuration = Date.now() - searchStartTime;

        // Cache the results
        if (results && results.length > 0) {
          await this.performanceCache.cacheSemanticSearchResult(
            normalized,
            topK,
            similarityThreshold,
            results,
          );
        }

        this.performanceMonitor.recordMetric(
          'semantic_search_embedding',
          embeddingDuration,
          {
            sessionId: context.sessionId,
            language,
            cacheHit: false,
            resultCount: results?.length || 0,
          },
        );
      }

      if (!results || results.length === 0) {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'semantic_search_no_results',
          duration,
          {
            sessionId: context.sessionId,
            language,
            cacheHit,
          },
        );

        return {
          movies: [],
          assistantText: templates.noResults,
        };
      }

      // 4) Filter out already suggested movies
      const filteredResults = this.filterSuggestedMovies(
        results.map((r) => r.movie),
        context,
      );

      if (filteredResults.length === 0) {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'semantic_search_all_suggested',
          duration,
          {
            sessionId: context.sessionId,
            language,
            cacheHit,
          },
        );

        return {
          movies: [],
          assistantText:
            'Mình đã gợi ý hết các phim phù hợp rồi. Bạn muốn thử chủ đề khác không?',
        };
      }

      // 5) Update context with suggested movies
      filteredResults.forEach((movie) => {
        if (movie.id) context.suggestedMovieIds.push(movie.id);
      });

      // 6) Generate assistant text with performance monitoring
      const textStartTime = Date.now();
      const assistantText = this.generateRecommendationText(
        filteredResults,
        language,
      );
      const textDuration = Date.now() - textStartTime;

      // 7) Get follow-up keywords
      const followUpKeywords = this.getFollowUpKeywords(
        this.intent,
        language,
        input.context.lastIntent
          ? { keywords: [input.context.lastIntent] }
          : undefined,
      );

      const totalDuration = Date.now() - startTime;

      // Record comprehensive performance metrics
      this.performanceMonitor.recordMetric(
        'semantic_search_total',
        totalDuration,
        {
          sessionId: context.sessionId,
          language,
          cacheHit,
          embeddingDuration,
          textDuration,
          movieCount: filteredResults.length,
          resultCount: results.length,
        },
      );

      return {
        movies: filteredResults,
        assistantText,
        followUpKeywords,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordError(
        'semantic_search_error',
        error as Error,
        {
          sessionId: context.sessionId,
          language,
          message: message.substring(0, 100),
        },
      );

      this.logger.error('Semantic search failed:', error);
      return {
        movies: [],
        assistantText: templates.genericError,
      };
    }
  }

  /**
   * Generate cache key for semantic search
   */
  private generateSearchCacheKey(
    query: string,
    topK: number,
    threshold: number,
  ): string {
    const normalizedQuery = query.toLowerCase().trim().substring(0, 200);
    return `search:${normalizedQuery}:${topK}:${threshold}`;
  }

  /**
   * Generate narrative, analytical recommendation text
   */
  private generateRecommendationText(
    movies: Partial<Movie>[],
    language: 'vi' | 'en',
  ): string {
    const startTime = Date.now();

    try {
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
    } finally {
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordMetric(
        'recommendation_text_generation',
        duration,
        {
          movieCount: movies.length,
        },
      );
    }
  }
}
