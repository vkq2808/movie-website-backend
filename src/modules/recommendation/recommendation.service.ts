import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Recommendation,
  RecommendationType,
  RecommendationSource,
} from './recommendation.entity';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { WatchHistory } from '../watch-history/watch-history.entity';
import { MoviePurchase } from '../movie-purchase/movie-purchase.entity';
import { Genre } from '../genre/genre.entity';
import {
  GetRecommendationsDto,
  RecommendationResponseDto,
  RecommendationStatsDto,
  GenerateRecommendationsDto,
} from './recommendation.dto';

// Typed helpers used within this module
type WatchingPatterns = {
  genreWeights: Record<string, number>;
};

type UserProfile = {
  genres: string[];
  languages: string[];
  decades: number[];
  actors: string[];
  directors: string[];
  averageRating: number;
  watchingPatterns: WatchingPatterns;
};

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(Recommendation)
    private readonly recommendationRepository: Repository<Recommendation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
    @InjectRepository(MoviePurchase)
    private readonly moviePurchaseRepository: Repository<MoviePurchase>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    filters: GetRecommendationsDto,
  ): Promise<{
    recommendations: RecommendationResponseDto[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const {
      type,
      limit = 20,
      page = 1,
      exclude_watched = true,
      exclude_purchased = false,
      min_score = 0,
    } = filters;

    // Check if user has recent recommendations, if not generate them
    await this.ensureUserHasRecommendations(userId);

    const offset = (page - 1) * limit;

    const queryBuilder = this.recommendationRepository
      .createQueryBuilder('rec')
      .leftJoinAndSelect('rec.movie', 'movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.original_language', 'original_language')
      .where('rec.user.id = :userId', { userId })
      .andWhere('rec.is_active = :isActive', { isActive: true })
      .andWhere('rec.score >= :minScore', { minScore: min_score });

    if (type) {
      queryBuilder.andWhere('rec.recommendation_type = :type', { type });
    }

    // Exclude already watched movies
    if (exclude_watched) {
      const watchedMovieIds = await this.getWatchedMovieIds(userId);
      if (watchedMovieIds.length > 0) {
        queryBuilder.andWhere('movie.id NOT IN (:...watchedMovieIds)', {
          watchedMovieIds,
        });
      }
    }

    // Exclude purchased movies
    if (exclude_purchased) {
      const purchasedMovieIds = await this.getPurchasedMovieIds(userId);
      if (purchasedMovieIds.length > 0) {
        queryBuilder.andWhere('movie.id NOT IN (:...purchasedMovieIds)', {
          purchasedMovieIds,
        });
      }
    }

    // Apply genre filter
    if (filters.genres && filters.genres.length > 0) {
      queryBuilder.andWhere('genres.id IN (:...genreIds)', {
        genreIds: filters.genres,
      });
    }

    const totalCount = await queryBuilder.getCount();

    const recommendations = await queryBuilder
      .orderBy('rec.score', 'DESC')
      .addOrderBy('rec.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const mappedRecommendations: RecommendationResponseDto[] =
      recommendations.map((rec) => ({
        id: rec.id,
        movie: rec.movie,
        recommendation_type: rec.recommendation_type,
        sources: rec.sources,
        score: rec.score,
        metadata: rec.metadata,
        created_at: rec.created_at,
      }));
    if (!mappedRecommendations || mappedRecommendations.length === 0) {
      this.logger.warn(
        `No recommendations found for user ${userId} with filters: ${JSON.stringify(filters)}`,
      );
      return await this.getTrendingMovies({
        limit,
        page,
        genres: filters.genres,
      });
    }

    return {
      recommendations: mappedRecommendations,
      total: totalCount,
      page,
      limit,
      hasMore: totalCount > offset + limit,
    };
  }

  /**
   * Generate recommendations for a user
   */
  async generateRecommendations(
    userId: string,
    options: GenerateRecommendationsDto = {},
  ): Promise<{ generated: number; updated: number }> {
    const { type, limit = 50, force_refresh = false } = options;

    this.logger.log(`Generating recommendations for user ${userId}`);

    // Clear existing recommendations if force refresh
    if (force_refresh) {
      await this.clearUserRecommendations(userId);
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['favorites', 'watch_histories', 'movie_purchases'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    const allRecommendations: Recommendation[] = [];

    if (!type || type === RecommendationType.CONTENT_BASED) {
      const contentBasedRecs = await this.generateContentBasedRecommendations(
        user,
        limit,
      );
      allRecommendations.push(...contentBasedRecs);
    }

    if (!type || type === RecommendationType.COLLABORATIVE) {
      const collaborativeRecs = await this.generateCollaborativeRecommendations(
        user,
        limit,
      );
      allRecommendations.push(...collaborativeRecs);
    }

    if (!type || type === RecommendationType.HYBRID) {
      const hybridRecs = await this.generateHybridRecommendations(user, limit);
      allRecommendations.push(...hybridRecs);
    }

    if (!type || type === RecommendationType.TRENDING) {
      const trendingRecs = await this.generateTrendingRecommendations(
        user,
        limit,
      );
      allRecommendations.push(...trendingRecs);
    }

    // Remove duplicates and sort by score
    const uniqueRecommendations =
      this.removeDuplicateRecommendations(allRecommendations);
    const topRecommendations = uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Save recommendations
    const { identifiers: savedRecommendations } =
      await this.recommendationRepository
        .createQueryBuilder()
        .insert()
        .values(topRecommendations)
        .orUpdate(
          ['score', 'recommendation_type', 'metadata', 'updated_at'], // các cột cần update
          ['userId', 'movieId'], // unique constraint
        )
        .execute();

    this.logger.log(
      `Generated ${savedRecommendations.length} recommendations for user ${userId}`,
    );

    return {
      generated: savedRecommendations.length,
      updated: 0,
    };
  }

  /**
   * Enhanced content-based recommendations with improved scoring
   */
  private async generateContentBasedRecommendations(
    user: User,
    limit: number,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get user's favorite movies and watch history
    const favoriteMovies = user.favorites || [];
    const watchHistory = user.watch_histories || [];

    if (favoriteMovies.length === 0 && watchHistory.length === 0) {
      // For new users, use trending content-based recommendations
      return this.generateNewUserContentRecommendations(user, limit);
    }

    // Extract comprehensive user preferences
    const userProfile = await this.buildUserProfile(user.id);
    const preferredGenres = userProfile.genres;
    const preferredLanguages = userProfile.languages;
    const preferredDecades = userProfile.decades;

    // Get candidate movies with enhanced filtering
    const candidateQuery = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.original_language', 'original_language')
      // Legacy joins removed: actor/director tables no longer used
      .where('movie.vote_average >= :minRating', { minRating: 5.5 })
      .andWhere('movie.popularity >= :minPopularity', { minPopularity: 5 });

    // Apply genre preferences with weighted scoring
    if (preferredGenres.length > 0) {
      candidateQuery.andWhere('genres.id IN (:...genreIds)', {
        genreIds: preferredGenres,
      });
    }

    // Apply language preferences
    if (preferredLanguages.length > 0) {
      candidateQuery.andWhere(
        'original_language.iso_639_1 IN (:...languageCodes)',
        { languageCodes: preferredLanguages },
      );
    }

    // Apply decade preferences (release year ranges)
    if (preferredDecades.length > 0) {
      const yearConditions = preferredDecades
        .map((decade) => {
          const startYear = decade;
          const endYear = decade + 9;
          return `(EXTRACT(YEAR FROM movie.release_date) BETWEEN ${startYear} AND ${endYear})`;
        })
        .join(' OR ');
      candidateQuery.andWhere(`(${yearConditions})`);
    }

    const candidateMovies = await candidateQuery
      .orderBy('movie.popularity', 'DESC')
      .addOrderBy('movie.vote_average', 'DESC')
      .limit(limit * 3)
      .getMany();

    // Filter out already watched/purchased movies
    const excludedIds = await this.getExcludedMovieIds(user.id);
    const filteredMovies = candidateMovies.filter(
      (movie) => !excludedIds.includes(movie.id),
    );

    // Enhanced scoring with multiple factors
    const scoredMovies = filteredMovies.map((movie) => {
      const score = this.calculateEnhancedContentScore(
        user,
        movie,
        userProfile,
      );
      return { movie, score };
    });

    // Sort by score and take top recommendations
    const topMovies = scoredMovies
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Create recommendation entities
    for (const { movie, score } of topMovies) {
      const matchingGenres =
        movie.genres
          ?.filter((g) => preferredGenres.includes(g.id))
          .map((g) => g.names?.[0]?.name || 'Unknown') || [];

      const recommendation = this.recommendationRepository.create({
        user,
        movie,
        recommendation_type: RecommendationType.CONTENT_BASED,
        sources: this.determineRecommendationSources(userProfile, movie),
        score,
        metadata: {
          matching_genres: matchingGenres,
          content_similarity_score: score,
          reasoning: this.generateReasoningText(
            userProfile,
            movie,
            matchingGenres,
          ),
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Collaborative filtering based on similar users
   */
  private async generateCollaborativeRecommendations(
    user: User,
    limit: number,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Find similar users based on watch history and favorites
    const similarUsers = await this.findSimilarUsers(user.id, 10);

    if (similarUsers.length === 0) {
      return recommendations;
    }

    // Get movies liked by similar users but not by current user
    const similarUserIds = similarUsers.map((u) => u.userId);
    const candidateMovies = await this.getMoviesLikedBySimilarUsers(
      user.id,
      similarUserIds,
      limit * 2,
    );

    for (const movieData of candidateMovies.slice(0, limit)) {
      const movie = await this.movieRepository.findOne({
        where: { id: movieData.movieId },
        relations: ['genres', 'original_language'],
      });

      if (!movie) continue;

      const userSimilarityScore =
        similarUsers.find((u) => u.userId === movieData.userId)?.similarity ||
        0;
      const score = userSimilarityScore * (movieData.rating / 10);

      const recommendation = this.recommendationRepository.create({
        user,
        movie,
        recommendation_type: RecommendationType.COLLABORATIVE,
        sources: [
          RecommendationSource.SIMILAR_USERS,
          RecommendationSource.USER_BEHAVIOR,
        ],
        score,
        metadata: {
          user_similarity_score: userSimilarityScore,
          reasoning: `Users with similar taste also liked this movie`,
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Hybrid recommendations combining content-based and collaborative
   */
  private async generateHybridRecommendations(
    user: User,
    limit: number,
  ): Promise<Recommendation[]> {
    const contentWeight = 0.6;
    const collaborativeWeight = 0.4;

    const contentRecs = await this.generateContentBasedRecommendations(
      user,
      Math.floor(limit * 0.6),
    );
    const collaborativeRecs = await this.generateCollaborativeRecommendations(
      user,
      Math.floor(limit * 0.4),
    );

    // Combine and adjust scores
    const hybridRecs = [
      ...contentRecs.map((rec) => ({
        ...rec,
        recommendation_type: RecommendationType.HYBRID,
        score: rec.score * contentWeight,
        sources: [...rec.sources, RecommendationSource.USER_BEHAVIOR],
      })),
      ...collaborativeRecs.map((rec) => ({
        ...rec,
        recommendation_type: RecommendationType.HYBRID,
        score: rec.score * collaborativeWeight,
        sources: [...rec.sources, RecommendationSource.GENRES],
      })),
    ];

    return hybridRecs.slice(0, limit);
  }

  /**
   * Trending recommendations based on popular movies
   */
  private async generateTrendingRecommendations(
    user: User,
    limit: number,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get trending movies (high popularity and recent)
    const trendingMovies = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.original_language', 'original_language')
      .where('movie.popularity >= :minPopularity', { minPopularity: 50 })
      .andWhere('movie.vote_average >= :minRating', { minRating: 7.0 })
      .andWhere('movie.release_date >= :recentDate', {
        recentDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
      })
      .orderBy('movie.popularity', 'DESC')
      .addOrderBy('movie.vote_average', 'DESC')
      .limit(limit * 2)
      .getMany();

    // Filter out already watched/purchased movies
    const watchedMovieIds = await this.getWatchedMovieIds(user.id);
    const purchasedMovieIds = await this.getPurchasedMovieIds(user.id);
    const favoriteMovieIds = user.favorites?.map((m) => m.id) || [];
    const excludedIds = [
      ...watchedMovieIds,
      ...purchasedMovieIds,
      ...favoriteMovieIds,
    ];

    const filteredMovies = trendingMovies.filter(
      (movie) => !excludedIds.includes(movie.id),
    );

    for (const movie of filteredMovies.slice(0, limit)) {
      const trendingScore = movie.popularity / 100 + movie.vote_average / 10;

      const recommendation = this.recommendationRepository.create({
        user,
        movie,
        recommendation_type: RecommendationType.TRENDING,
        sources: [RecommendationSource.USER_BEHAVIOR],
        score: trendingScore,
        metadata: {
          trending_score: trendingScore,
          reasoning: `Currently trending movie with high ratings`,
        },
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      });

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private async ensureUserHasRecommendations(userId: string): Promise<void> {
    const recentRecommendations = await this.recommendationRepository.count({
      where: {
        user: { id: userId },
        is_active: true,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    });

    if (recentRecommendations < 10) {
      await this.generateRecommendations(userId, { limit: 50 });
    }
  }

  private async getWatchedMovieIds(userId: string): Promise<string[]> {
    const watchHistory = await this.watchHistoryRepository.find({
      where: { user: { id: userId } },
      relations: ['movie'],
    });
    return watchHistory.map((wh) => wh.movie.id);
  }

  private async getPurchasedMovieIds(userId: string): Promise<string[]> {
    const purchases = await this.moviePurchaseRepository.find({
      where: { user: { id: userId } },
      relations: ['movie'],
    });
    return purchases.map((p) => p.movie.id);
  }

  private async extractUserPreferredGenres(userId: string): Promise<string[]> {
    try {
      const result = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoin('movie.genres', 'genre')
        .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
        .leftJoin('watch_history', 'wh', 'wh.movie_id = movie.id')
        .where('ufm.user_id = :userId OR wh.user_id = :userId', { userId })
        .select('genre.id', 'genreId')
        .addSelect('COUNT(*)', 'genreInteractionCount')
        .groupBy('genre.id')
        .orderBy('COUNT(*)', 'DESC')
        .limit(5)
        .getRawMany<{
          genreId: string | null;
          genreInteractionCount: string;
        }>();

      return result.map((r) => r.genreId as string).filter(Boolean);
    } catch (error) {
      this.logger.warn(
        `Error extracting preferred genres for userId: ${userId}. Error: ${error}`,
      );
      return [];
    }
  }

  private async extractUserPreferredLanguages(
    userId: string,
  ): Promise<string[]> {
    try {
      const result = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoin('movie.original_language', 'lang')
        .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
        .leftJoin('watch_history', 'wh', 'wh.movie_id = movie.id')
        .where('ufm.user_id = :userId OR wh.user_id = :userId', { userId })
        .select('lang.iso_639_1', 'languageCode')
        .addSelect('COUNT(*)', 'languageInteractionCount')
        .groupBy('lang.iso_639_1')
        .orderBy('COUNT(*)', 'DESC')
        .limit(3)
        .getRawMany<{
          languageCode: string | null;
          languageInteractionCount: string;
        }>();

      return result.map((r) => r.languageCode as string).filter(Boolean);
    } catch (error) {
      this.logger.warn(
        `Error extracting preferred languages for userId: ${userId}. Error: ${error}`,
      );
      return [];
    }
  }

  private async calculateContentSimilarityScore(
    user: User,
    movie: Movie,
  ): Promise<number> {
    let score = 0;

    // Base score from movie quality
    score += (movie.vote_average / 10) * 0.3;
    score += Math.min(movie.popularity / 100, 1) * 0.2;

    // Genre similarity (will be calculated based on user preferences)
    const userGenres = await this.extractUserPreferredGenres(user.id);
    const movieGenreIds = movie.genres?.map((g) => g.id) || [];
    const genreMatch = movieGenreIds.filter((gId) =>
      userGenres.includes(gId),
    ).length;
    score += (genreMatch / Math.max(userGenres.length, 1)) * 0.3;

    // Language preference
    const userLanguages = await this.extractUserPreferredLanguages(user.id);
    if (
      movie.original_language &&
      userLanguages.includes(movie.original_language.iso_639_1)
    ) {
      score += 0.2;
    }

    return Math.min(score, 10); // Cap at 10
  }

  private async findSimilarUsers(
    userId: string,
    limit: number,
  ): Promise<Array<{ userId: string; similarity: number }>> {
    try {
      // Simplified similarity calculation based on common favorites and watch history
      const result = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user_favorites', 'ufm1', 'ufm1.user_id = user.id')
        .leftJoin(
          'user_favorites',
          'ufm2',
          'ufm2.movie_id = ufm1.movie_id AND ufm2.user_id = :userId',
          { userId },
        )
        .where('user.id != :userId', { userId })
        .andWhere('ufm2.user_id IS NOT NULL')
        .select('user.id', 'userId')
        .addSelect('COUNT(ufm1.movie_id)', 'commonMoviesCount')
        .groupBy('user.id')
        .having('COUNT(ufm1.movie_id) > 0')
        .orderBy('COUNT(ufm1.movie_id)', 'DESC')
        .limit(limit)
        .getRawMany<{ userId: string; commonMoviesCount: string }>();

      return result.map((r) => ({
        userId: r.userId,
        similarity: Math.min(parseInt(r.commonMoviesCount) / 10, 1), // Normalize similarity
      }));
    } catch (error) {
      this.logger.warn(
        `Error finding similar users for userId: ${userId}. Error: ${error}`,
      );
      return [];
    }
  }

  private async getMoviesLikedBySimilarUsers(
    userId: string,
    similarUserIds: string[],
    limit: number,
  ): Promise<Array<{ movieId: string; userId: string; rating: number }>> {
    const result = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
      .leftJoin(
        'user_favorites',
        'current_user_fav',
        'current_user_fav.movie_id = movie.id AND current_user_fav.user_id = :userId',
        { userId },
      )
      .where('ufm.user_id IN (:...similarUserIds)', { similarUserIds })
      .andWhere('current_user_fav.user_id IS NULL') // Not already liked by current user
      .select('movie.id', 'movieId')
      .addSelect('ufm.user_id', 'userId')
      .addSelect('movie.vote_average', 'rating')
      .orderBy('movie.vote_average', 'DESC')
      .limit(limit)
      .getRawMany<{ movieId: string; userId: string; rating: number }>();

    return result;
  }

  private removeDuplicateRecommendations(
    recommendations: Recommendation[],
  ): Recommendation[] {
    const seen = new Set<string>();
    return recommendations.filter((rec) => {
      const key = `${rec.user.id}-${rec.movie.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async clearUserRecommendations(userId: string): Promise<void> {
    await this.recommendationRepository.delete({
      user: { id: userId },
    });
  }

  /**
   * Get recommendation statistics for a user
   */
  async getRecommendationStats(
    userId: string,
  ): Promise<RecommendationStatsDto> {
    try {
      const totalRecommendations = await this.recommendationRepository.count({
        where: { user: { id: userId }, is_active: true },
      });

      const byType = await this.recommendationRepository
        .createQueryBuilder('rec')
        .select('rec.recommendation_type', 'type')
        .addSelect('COUNT(*)', 'typeCount')
        .where('rec.user.id = :userId', { userId })
        .andWhere('rec.is_active = :isActive', { isActive: true })
        .groupBy('rec.recommendation_type')
        .getRawMany<{ type: RecommendationType; typeCount: string }>();

      const bySource = await this.recommendationRepository
        .createQueryBuilder('rec')
        .select('UNNEST(rec.sources)', 'source')
        .addSelect('COUNT(*)', 'sourceCount')
        .where('rec.user.id = :userId', { userId })
        .andWhere('rec.is_active = :isActive', { isActive: true })
        .groupBy('source')
        .getRawMany<{ source: RecommendationSource; sourceCount: string }>();

      const avgScore = await this.recommendationRepository
        .createQueryBuilder('rec')
        .select('AVG(rec.score)', 'scoreAverage')
        .where('rec.user.id = :userId', { userId })
        .andWhere('rec.is_active = :isActive', { isActive: true })
        .getRawOne<{ scoreAverage: string }>();

      const lastUpdated = await this.recommendationRepository
        .createQueryBuilder('rec')
        .select('MAX(rec.updated_at)', 'maxUpdatedAt')
        .where('rec.user.id = :userId', { userId })
        .getRawOne<{ maxUpdatedAt: Date }>();

      return {
        total_recommendations: totalRecommendations,
        by_type: byType.reduce<Record<RecommendationType, number>>(
          (acc, item) => {
            acc[item.type] = parseInt(item.typeCount);
            return acc;
          },
          {} as Record<RecommendationType, number>,
        ),
        by_source: bySource.reduce<Record<RecommendationSource, number>>(
          (acc, item) => {
            acc[item.source] = parseInt(item.sourceCount);
            return acc;
          },
          {} as Record<RecommendationSource, number>,
        ),
        average_score: parseFloat(avgScore?.scoreAverage || '0'),
        last_updated: lastUpdated?.maxUpdatedAt || new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error getting recommendation stats for userId: ${userId}. Error: ${error}`,
      );
      // Return safe defaults on error
      const emptyByType = Object.values(RecommendationType).reduce(
        (acc, t) => {
          acc[t] = 0;
          return acc;
        },
        {} as Record<RecommendationType, number>,
      );
      const emptyBySource = Object.values(RecommendationSource).reduce(
        (acc, s) => {
          acc[s] = 0;
          return acc;
        },
        {} as Record<RecommendationSource, number>,
      );
      return {
        total_recommendations: 0,
        by_type: emptyByType,
        by_source: emptyBySource,
        average_score: 0,
        last_updated: new Date(),
      };
    }
  }

  /**
   * Cleanup expired recommendations
   */
  async cleanupExpiredRecommendations(): Promise<{ deletedCount: number }> {
    const result = await this.recommendationRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} expired recommendations`);

    return { deletedCount: result.affected || 0 };
  }

  // =====================================================
  // ENHANCED RECOMMENDATION HELPER METHODS
  // =====================================================

  /**
   * Build comprehensive user profile for better recommendations
   */
  private async buildUserProfile(userId: string): Promise<UserProfile> {
    try {
      // Get preferred genres with weights
      // FIXED: Use raw expression in orderBy instead of alias for aggregate functions
      const genrePreferences = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoin('movie.genres', 'genre')
        .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
        .leftJoin('watch_history', 'wh', 'wh.movie_id = movie.id')
        .where('ufm.user_id = :userId OR wh.user_id = :userId', { userId })
        .select('genre.id', 'genreId')
        .addSelect('COUNT(*)', 'interactionCount')
        .addSelect('AVG(movie.vote_average)', 'avgVoteRating')
        .groupBy('genre.id')
        .orderBy('interactionCount', 'DESC')
        .addOrderBy('AVG(movie.vote_average)', 'DESC')
        .limit(8)
        .getRawMany<{
          genreId: string | null;
          interactionCount: string;
          avgVoteRating: string;
        }>();

      // Get preferred languages
      const languagePreferences = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoin('movie.original_language', 'lang')
        .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
        .leftJoin('watch_history', 'wh', 'wh.movie_id = movie.id')
        .where('ufm.user_id = :userId OR wh.user_id = :userId', { userId })
        .select('lang.iso_639_1', 'languageCode')
        .addSelect('COUNT(*)', 'interactionCount')
        .groupBy('lang.iso_639_1')
        .orderBy('interactionCount', 'DESC')
        .limit(5)
        .getRawMany<{
          languageCode: string | null;
          interactionCount: string;
        }>();

      // Get preferred decades
      const decadePreferences = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
        .leftJoin('watch_history', 'wh', 'wh.movie_id = movie.id')
        .where('ufm.user_id = :userId OR wh.user_id = :userId', { userId })
        .select(
          'FLOOR(EXTRACT(YEAR FROM movie.release_date) / 10) * 10',
          'decade',
        )
        .addSelect('COUNT(*)', 'interactionCount')
        .groupBy('decade')
        .orderBy('interactionCount', 'DESC')
        .limit(3)
        .getRawMany<{ decade: string; interactionCount: string }>();

      // Calculate average rating preference
      const avgRatingPreference = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoin('user_favorites', 'ufm', 'ufm.movie_id = movie.id')
        .leftJoin('watch_history', 'wh', 'wh.movie_id = movie.id')
        .where('ufm.user_id = :userId OR wh.user_id = :userId', { userId })
        .select('AVG(movie.vote_average)', 'avgVoteRating')
        .getRawOne<{ avgVoteRating: string }>();

      return {
        genres: genrePreferences
          .map((g) => g.genreId)
          .filter((x): x is string => Boolean(x)),
        languages: languagePreferences
          .map((l) => l.languageCode)
          .filter((x): x is string => Boolean(x)),
        decades: decadePreferences
          .map((d) => parseInt(d.decade))
          .filter(Boolean),
        actors: [], // Will be implemented when actor-movie relationships are established
        directors: [], // Will be implemented when director-movie relationships are established
        averageRating: parseFloat(avgRatingPreference?.avgVoteRating || '7.0'),
        watchingPatterns: {
          genreWeights: genrePreferences.reduce<Record<string, number>>(
            (acc, g) => {
              if (g.genreId) acc[g.genreId] = parseInt(g.interactionCount);
              return acc;
            },
            {},
          ),
        },
      };
    } catch (error) {
      this.logger.warn(
        `Error building user profile for userId: ${userId}. Error: ${error}`,
      );
      // Fallback to empty profile
      return {
        genres: [],
        languages: [],
        decades: [],
        actors: [],
        directors: [],
        averageRating: 7.0,
        watchingPatterns: { genreWeights: {} },
      };
    }
  }

  /**
   * Generate recommendations for new users with no history
   */
  private async generateNewUserContentRecommendations(
    user: User,
    limit: number,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get popular, high-quality movies across different genres
    const popularMovies = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.original_language', 'original_language')
      .where('movie.vote_average >= :minRating', { minRating: 7.5 })
      .andWhere('movie.popularity >= :minPopularity', { minPopularity: 30 })
      .andWhere('movie.vote_count >= :minVotes', { minVotes: 1000 })
      .orderBy('movie.popularity', 'DESC')
      .addOrderBy('movie.vote_average', 'DESC')
      .limit(limit)
      .getMany();

    for (const movie of popularMovies) {
      const score =
        (movie.vote_average / 10) * 0.6 +
        Math.min(movie.popularity / 100, 1) * 0.4;

      const recommendation = this.recommendationRepository.create({
        user,
        movie,
        recommendation_type: RecommendationType.CONTENT_BASED,
        sources: [RecommendationSource.USER_BEHAVIOR],
        score,
        metadata: {
          content_similarity_score: score,
          reasoning:
            'Popular highly-rated movie perfect for discovering new content',
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Calculate enhanced content similarity score
   */
  private calculateEnhancedContentScore(
    user: User,
    movie: Movie,
    userProfile: UserProfile,
  ): number {
    let score = 0;

    // Base movie quality score (30%)
    const qualityScore =
      (movie.vote_average / 10) * 0.2 +
      Math.min(movie.popularity / 100, 1) * 0.1;
    score += qualityScore * 0.3;

    // Genre matching score (25%)
    const movieGenreIds = movie.genres?.map((g) => g.id) || [];
    const genreMatches = movieGenreIds.filter((gId) =>
      userProfile.genres.includes(gId),
    ).length;
    const genreScore = genreMatches / Math.max(userProfile.genres.length, 1);
    score += genreScore * 0.25;

    // Language preference score (15%)
    if (
      movie.original_language &&
      userProfile.languages.includes(movie.original_language.iso_639_1)
    ) {
      score += 0.15;
    }

    // Decade preference score (10%)
    const movieYear = movie.release_date
      ? new Date(movie.release_date).getFullYear()
      : 0;
    const movieDecade = Math.floor(movieYear / 10) * 10;
    if (userProfile.decades.includes(movieDecade)) {
      score += 0.1;
    }

    // Rating alignment score (10%)
    const ratingDiff = Math.abs(movie.vote_average - userProfile.averageRating);
    const ratingScore = Math.max(0, 1 - ratingDiff / 5); // Normalize rating difference
    score += ratingScore * 0.1;

    // Actor preference score (5%)
    // This would require actor data to be properly implemented

    // Director preference score (5%)
    // This would require director data to be properly implemented

    return Math.min(score * 10, 10); // Scale to 0-10 and cap at 10
  }

  /**
   * Determine recommendation sources based on matching factors
   */
  private determineRecommendationSources(
    userProfile: UserProfile,
    movie: Movie,
  ): RecommendationSource[] {
    const sources: RecommendationSource[] = [];

    // Check what factors contributed to this recommendation
    const movieGenreIds = movie.genres?.map((g) => g.id) || [];
    if (movieGenreIds.some((gId) => userProfile.genres.includes(gId))) {
      sources.push(RecommendationSource.GENRES);
    }

    if (
      movie.original_language &&
      userProfile.languages.includes(movie.original_language.iso_639_1)
    ) {
      sources.push(RecommendationSource.LANGUAGES);
    }

    // Add actor/director sources if they match
    if (userProfile.actors.length > 0) {
      sources.push(RecommendationSource.ACTORS);
    }

    if (userProfile.directors.length > 0) {
      sources.push(RecommendationSource.DIRECTORS);
    }

    // Always include user behavior as a source
    sources.push(RecommendationSource.USER_BEHAVIOR);

    return sources;
  }

  /**
   * Generate reasoning text for recommendations
   */
  private generateReasoningText(
    userProfile: UserProfile,
    movie: Movie,
    matchingGenres: string[],
  ): string {
    const reasons: string[] = [];

    if (matchingGenres.length > 0) {
      reasons.push(
        `matches your interest in ${matchingGenres.slice(0, 2).join(' and ')} movies`,
      );
    }

    if (movie.vote_average >= userProfile.averageRating) {
      reasons.push(`has high ratings similar to your preferences`);
    }

    if (
      movie.original_language &&
      userProfile.languages.includes(movie.original_language.iso_639_1)
    ) {
      reasons.push(`is in your preferred language`);
    }

    const movieYear = movie.release_date
      ? new Date(movie.release_date).getFullYear()
      : 0;
    const movieDecade = Math.floor(movieYear / 10) * 10;
    if (userProfile.decades.includes(movieDecade)) {
      reasons.push(`is from the ${movieDecade}s, a decade you enjoy`);
    }

    if (reasons.length === 0) {
      return 'is a popular, highly-rated movie you might enjoy';
    }

    return `This movie ${reasons.join(', ')}.`;
  }

  /**
   * Get all excluded movie IDs for a user
   */
  private async getExcludedMovieIds(userId: string): Promise<string[]> {
    const [watchedIds, purchasedIds, favoriteIds] = await Promise.all([
      this.getWatchedMovieIds(userId),
      this.getPurchasedMovieIds(userId),
      this.getFavoriteMovieIds(userId),
    ]);

    return [...new Set([...watchedIds, ...purchasedIds, ...favoriteIds])];
  }

  /**
   * Get user's favorite movie IDs
   */
  private async getFavoriteMovieIds(userId: string): Promise<string[]> {
    const favorites = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.favorites', 'movie')
      .where('user.id = :userId', { userId })
      .select('movie.id', 'movieId')
      .getRawMany<{ movieId: string | null }>();
    const ids: string[] = [];
    for (const f of favorites) {
      if (f.movieId) ids.push(f.movieId);
    }
    return ids;
  }

  /**
   * Get trending movies (public endpoint, no authentication required)
   */
  async getTrendingMovies(filters: GetRecommendationsDto): Promise<{
    recommendations: RecommendationResponseDto[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { limit = 20, page = 1 } = filters;
    const offset = (page - 1) * limit;

    this.logger.log(
      `Getting trending movies with filters: ${JSON.stringify(filters)}`,
    );

    // Try to get trending movies with high popularity first
    let [trendingMovies, total] = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.original_language', 'original_language')
      .where('movie.popularity >= :minPopularity', { minPopularity: 30 })
      .andWhere('movie.vote_average >= :minRating', { minRating: 6.0 })
      .orderBy('movie.popularity', 'DESC')
      .addOrderBy('movie.vote_average', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    this.logger.log(
      `First query result: ${trendingMovies.length} movies found with strict criteria`,
    );

    // If no movies found with strict criteria, fallback to less strict criteria
    if (trendingMovies.length === 0) {
      this.logger.log(
        'No movies found with strict criteria, trying less strict criteria',
      );
      [trendingMovies, total] = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoinAndSelect('movie.genres', 'genres')
        .leftJoinAndSelect('movie.original_language', 'original_language')
        .where('movie.popularity >= :minPopularity', { minPopularity: 10 })
        .andWhere('movie.vote_average >= :minRating', { minRating: 5.0 })
        .orderBy('movie.popularity', 'DESC')
        .addOrderBy('movie.vote_average', 'DESC')
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      this.logger.log(
        `Second query result: ${trendingMovies.length} movies found with less strict criteria`,
      );
    }

    // If still no movies found, get any movies ordered by popularity and rating
    if (trendingMovies.length === 0) {
      this.logger.log(
        'No movies found with less strict criteria, trying any movies',
      );
      [trendingMovies, total] = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoinAndSelect('movie.genres', 'genres')
        .leftJoinAndSelect('movie.original_language', 'original_language')
        .where('movie.vote_average > :minRating', { minRating: 0 })
        .orderBy('movie.popularity', 'DESC')
        .addOrderBy('movie.vote_average', 'DESC')
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      this.logger.log(
        `Third query result: ${trendingMovies.length} movies found with any criteria`,
      );
    }

    // Final fallback: get any movies without any filters
    if (trendingMovies.length === 0) {
      this.logger.log(
        'No movies found with any criteria, getting any movies from database',
      );
      [trendingMovies, total] = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoinAndSelect('movie.genres', 'genres')
        .leftJoinAndSelect('movie.original_language', 'original_language')
        .orderBy('movie.id', 'DESC')
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      this.logger.log(
        `Final fallback query result: ${trendingMovies.length} movies found`,
      );
    }

    // Transform to recommendation format
    const recommendations: RecommendationResponseDto[] = trendingMovies.map(
      (movie) => {
        const trendingScore = movie.popularity / 100 + movie.vote_average / 10;

        return {
          id: `trending-${movie.id}`,
          recommendation_type: RecommendationType.TRENDING,
          sources: [RecommendationSource.USER_BEHAVIOR],
          score: trendingScore,
          movie,
          metadata: {
            trending_score: trendingScore,
            reasoning: 'Currently trending movie with high ratings',
          },
          created_at: new Date(),
        };
      },
    );

    const hasMore = offset + limit < total;

    this.logger.log(
      `Returning trending movies result: ${recommendations.length} recommendations, total: ${total}, page: ${page}, limit: ${limit}, hasMore: ${hasMore}`,
    );

    return {
      recommendations,
      total,
      page,
      limit,
      hasMore,
    };
  }
}
