import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchHistory } from './watch-history.entity';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
  ) {}

  /**
   * Add or update watch history for a user
   * Used for tracking video watch progress
   */
  async addWatchHistory(
    userId: string,
    movieId: string,
    progress: number,
  ): Promise<WatchHistory> {
    // Check if watch history already exists
    let watchHistory = await this.watchHistoryRepository.findOne({
      where: {
        user: { id: userId },
        movie: { id: movieId },
      },
    });

    if (watchHistory) {
      // Update existing watch history
      watchHistory.progress = progress;
      watchHistory.updated_at = new Date();
    } else {
      // Create new watch history
      watchHistory = this.watchHistoryRepository.create({
        user: { id: userId } as User,
        movie: { id: movieId } as Movie,
        progress,
      });
    }

    return this.watchHistoryRepository.save(watchHistory);
  }

  /**
   * Add or update watch history entry (idempotent)
   * Used for view tracking - does NOT rely on progress
   * 
   * Business Rule: One user + one movie = one watch history record
   * Creates new record if not exists, updates timestamp if exists
   * 
   * @param userId - User ID
   * @param movieId - Movie ID
   * @returns WatchHistory record
   */
  async addOrUpdateHistory(
    userId: string,
    movieId: string,
  ): Promise<WatchHistory> {
    try {
      // Check if watch history already exists
      let watchHistory = await this.watchHistoryRepository.findOne({
        where: {
          user: { id: userId },
          movie: { id: movieId },
        },
      });

      if (watchHistory) {
        // Update existing - just touch the updated_at timestamp
        watchHistory.updated_at = new Date();
      } else {
        // Create new watch history with 0 progress
        watchHistory = this.watchHistoryRepository.create({
          user: { id: userId } as User,
          movie: { id: movieId } as Movie,
          progress: 0,
        });
      }

      return await this.watchHistoryRepository.save(watchHistory);
    } catch (error) {
      // Handle unique constraint violation gracefully
      // This can happen in race conditions
      console.error('[addOrUpdateHistory] Error:', error);
      
      // Try to fetch existing record
      const existing = await this.watchHistoryRepository.findOne({
        where: {
          user: { id: userId },
          movie: { id: movieId },
        },
      });
      
      if (existing) {
        return existing;
      }
      
      throw error;
    }
  }

  /**
   * Get watch history for a user
   */
  async getUserWatchHistory(
    userId: string,
    limit: number = 20,
    page: number = 1,
  ): Promise<{
    watchHistory: WatchHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    const [watchHistory, total] =
      await this.watchHistoryRepository.findAndCount({
        where: { user: { id: userId } },
        relations: ['movie', 'movie.genres'],
        order: { updated_at: 'DESC' },
        skip: offset,
        take: limit,
      });

    return {
      watchHistory,
      total,
      page,
      limit,
    };
  }

  /**
   * Get recently watched movies for a user
   */
  async getRecentlyWatched(
    userId: string,
    limit: number = 10,
  ): Promise<Movie[]> {
    const watchHistory = await this.watchHistoryRepository.find({
      where: { user: { id: userId } },
      relations: ['movie', 'movie.genres'],
      order: { updated_at: 'DESC' },
      take: limit,
    });

    return watchHistory.map((wh) => wh.movie);
  }

  /**
   * Get movies watched by user IDs (for collaborative filtering)
   */
  async getMoviesWatchedByUsers(
    userIds: string[],
  ): Promise<Array<{ userId: string; movieId: string; progress: number }>> {
    const watchHistory = await this.watchHistoryRepository
      .createQueryBuilder('wh')
      .leftJoin('wh.user', 'user')
      .leftJoin('wh.movie', 'movie')
      .where('user.id IN (:...userIds)', { userIds })
      .select([
        'user.id as userId',
        'movie.id as movieId',
        'wh.progress as progress',
      ])
      .getRawMany<{ userId: string; movieId: string; progress: number }>();

    return watchHistory;
  }

  /**
   * Get user's watch progress for a specific movie
   */
  async getWatchProgress(userId: string, movieId: string): Promise<number> {
    const watchHistory = await this.watchHistoryRepository.findOne({
      where: {
        user: { id: userId },
        movie: { id: movieId },
      },
    });

    return watchHistory?.progress || 0;
  }

  /**
   * Get watch statistics for a user
   */
  async getUserWatchStats(userId: string): Promise<{
    totalMoviesWatched: number;
    totalWatchTime: number; // Based on progress
    averageProgress: number;
    favoriteGenres: Array<{ genreId: string; count: number }>;
  }> {
    // Get total movies watched
    const totalMoviesWatched = await this.watchHistoryRepository.count({
      where: { user: { id: userId } },
    });

    // Get watch history with progress and genres
    const watchHistoryWithGenres = await this.watchHistoryRepository
      .createQueryBuilder('wh')
      .leftJoin('wh.movie', 'movie')
      .leftJoin('movie.genres', 'genre')
      .where('wh.user.id = :userId', { userId })
      .select(['wh.progress', 'genre.id as genreId'])
      .getRawMany<{ progress: number | null; genreId: string | null }>();

    // Calculate average progress
    const totalProgress = watchHistoryWithGenres.reduce<number>((sum, wh) => {
      return sum + (wh.progress ?? 0);
    }, 0);
    const averageProgress =
      totalMoviesWatched > 0 ? totalProgress / totalMoviesWatched : 0;

    // Calculate favorite genres
    const genreCounts = watchHistoryWithGenres.reduce<Record<string, number>>(
      (acc, wh) => {
        if (wh.genreId) {
          acc[wh.genreId] = (acc[wh.genreId] ?? 0) + 1;
        }
        return acc;
      },
      {},
    );

    const favoriteGenres: Array<{ genreId: string; count: number }> =
      Object.entries(genreCounts)
        .map(([genreId, count]) => ({ genreId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
      totalMoviesWatched,
      totalWatchTime: totalProgress, // This could be enhanced with actual movie durations
      averageProgress,
      favoriteGenres,
    };
  }

  /**
   * Delete watch history entry
   */
  async deleteWatchHistory(userId: string, movieId: string): Promise<void> {
    await this.watchHistoryRepository.delete({
      user: { id: userId },
      movie: { id: movieId },
    });
  }

  /**
   * Clear all watch history for a user
   */
  async clearUserWatchHistory(userId: string): Promise<void> {
    await this.watchHistoryRepository.delete({
      user: { id: userId },
    });
  }
}
