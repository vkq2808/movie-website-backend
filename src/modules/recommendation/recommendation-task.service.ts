import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecommendationService } from '../recommendation/recommendation.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { RecommendationType } from './recommendation.entity';

@Injectable()
export class RecommendationTaskService {
  private readonly logger = new Logger(RecommendationTaskService.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Daily recommendation update for active users
   * Runs every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateDailyRecommendations() {
    this.logger.log('Starting daily recommendation update...');

    try {
      // Get active users who need recommendation updates
      const activeUsers = await this.userRepository
        .createQueryBuilder('user')
        .where('user.is_active = :isActive', { isActive: true })
        .andWhere('user.updated_at >= :recentDate', {
          recentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Active in last 30 days
        })
        .select(['user.id'])
        .getMany();

      this.logger.log(
        `Found ${activeUsers.length} active users for recommendation update`,
      );

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      let processedUsers = 0;
      let successfulUpdates = 0;

      for (let i = 0; i < activeUsers.length; i += batchSize) {
        const userBatch = activeUsers.slice(i, i + batchSize);

        const batchPromises = userBatch.map(async (user) => {
          try {
            await this.recommendationService.generateRecommendations(user.id, {
              limit: 50,
              force_refresh: false,
            });
            successfulUpdates++;
            return true;
          } catch (error) {
            this.logger.error(
              `Failed to update recommendations for user ${user.id}:`,
              error,
            );
            return false;
          }
        });

        await Promise.all(batchPromises);
        processedUsers += userBatch.length;

        this.logger.log(
          `Processed ${processedUsers}/${activeUsers.length} users`,
        );

        // Add a small delay between batches to be kind to the database
        if (i + batchSize < activeUsers.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      this.logger.log(
        `Daily recommendation update completed. Processed: ${processedUsers}, Successful: ${successfulUpdates}`,
      );
    } catch (error) {
      this.logger.error('Error during daily recommendation update:', error);
    }
  }

  /**
   * Weekly cleanup of expired recommendations
   * Runs every Sunday at 3 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupExpiredRecommendations() {
    this.logger.log('Starting weekly cleanup of expired recommendations...');

    try {
      const result =
        await this.recommendationService.cleanupExpiredRecommendations();
      this.logger.log(
        `Cleaned up ${result.deletedCount} expired recommendations`,
      );
    } catch (error) {
      this.logger.error('Error during recommendation cleanup:', error);
    }
  }

  /**
   * Generate recommendations for new users
   * Runs every hour to catch new user registrations
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateRecommendationsForNewUsers() {
    this.logger.log('Checking for new users without recommendations...');

    try {
      // Find users who don't have any recommendations yet
      const usersWithoutRecommendations = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('recommendations', 'rec', 'rec.userId = user.id')
        .where('user.is_active = :isActive', { isActive: true })
        .andWhere('rec.id IS NULL')
        .andWhere('user.created_at >= :recentDate', {
          recentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Created in last 7 days
        })
        .select(['user.id'])
        .getMany();

      if (usersWithoutRecommendations.length === 0) {
        this.logger.log('No new users found without recommendations');
        return;
      }

      this.logger.log(
        `Found ${usersWithoutRecommendations.length} new users without recommendations`,
      );

      // Generate recommendations for new users
      let successCount = 0;
      for (const user of usersWithoutRecommendations) {
        try {
          await this.recommendationService.generateRecommendations(user.id, {
            limit: 30,
            force_refresh: false,
          });
          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to generate recommendations for new user ${user.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Generated recommendations for ${successCount}/${usersWithoutRecommendations.length} new users`,
      );
    } catch (error) {
      this.logger.error(
        'Error during new user recommendation generation:',
        error,
      );
    }
  }

  /**
   * Update trending recommendations
   * Runs every 6 hours to keep trending content fresh
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async updateTrendingRecommendations() {
    this.logger.log('Updating trending recommendations...');

    try {
      // Get a sample of active users to update their trending recommendations
      const sampleUsers = await this.userRepository
        .createQueryBuilder('user')
        .where('user.is_active = :isActive', { isActive: true })
        .orderBy('RANDOM()')
        .limit(100) // Update trending for 100 random users
        .select(['user.id'])
        .getMany();

      let successCount = 0;
      for (const user of sampleUsers) {
        try {
          await this.recommendationService.generateRecommendations(user.id, {
            type: RecommendationType.TRENDING,
            limit: 20,
            force_refresh: true,
          });
          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to update trending recommendations for user ${user.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Updated trending recommendations for ${successCount}/${sampleUsers.length} users`,
      );
    } catch (error) {
      this.logger.error('Error during trending recommendation update:', error);
    }
  }
}
