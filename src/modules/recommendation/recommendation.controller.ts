import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
  Body,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RecommendationService } from './recommendation.service';
import {
  GetRecommendationsDto,
  RecommendationResponseDto,
  RecommendationStatsDto,
  GenerateRecommendationsDto,
  BulkGenerateRecommendationsDto,
} from './recommendation.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) { }

  /**
   * Get recommendations for users (both authenticated and unauthenticated)
   * - If user is authenticated: return personalized recommendations
   * - If user is not authenticated: return trending movies
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getRecommendations(
    @Request() req: any,
    @Query() filters: GetRecommendationsDto,
  ) {
    const user = req.user;

    console.log('Recommendations endpoint hit:', {
      user: user ? { sub: user.sub } : null,
      filters,
      hasUser: !!(user && user.sub)
    });

    if (user && user.sub) {
      // User is authenticated - return personalized recommendations
      const userId = user.sub;
      console.log('Fetching personalized recommendations for user:', userId);
      const result = await this.recommendationService.getRecommendations(userId, filters);

      return ResponseUtil.success(result, 'Personalized recommendations retrieved successfully');
    } else {
      // User is not authenticated - return trending movies
      console.log('Fetching trending movies for unauthenticated user');
      const result = await this.recommendationService.getTrendingMovies(filters);

      console.log('Trending movies result:', {
        total: result.total,
        recommendationsCount: result.recommendations.length,
        page: result.page,
        limit: result.limit
      });

      return ResponseUtil.success(result, 'Trending movie recommendations retrieved successfully');
    }
  }

  /**
   * Get personalized recommendations for authenticated users only
   */
  @Get('personalized')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getPersonalizedRecommendations(
    @Request() req: any,
    @Query() filters: GetRecommendationsDto,
  ) {
    const userId = req.user.sub;
    const result = await this.recommendationService.getRecommendations(userId, filters);

    return ResponseUtil.success(result, 'Personalized recommendations retrieved successfully');
  }

  /**
   * Generate new recommendations for the current user
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateRecommendations(
    @Request() req: any,
    @Body() options: GenerateRecommendationsDto,
  ) {
    const userId = req.user.sub;
    const result = await this.recommendationService.generateRecommendations(userId, options);

    return ResponseUtil.success(result, 'Recommendations generated successfully');
  }

  /**
   * Get recommendation statistics for the current user
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getRecommendationStats(@Request() req: any) {
    const userId = req.user.sub;
    const stats = await this.recommendationService.getRecommendationStats(userId);

    return ResponseUtil.success(stats, 'Recommendation statistics retrieved successfully');
  }

  /**
   * Admin endpoint: Generate recommendations for multiple users
   */
  @Post('bulk-generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @UsePipes(new ValidationPipe({ transform: true }))
  async bulkGenerateRecommendations(
    @Body() options: BulkGenerateRecommendationsDto,
  ) {
    // Implementation for bulk generation would go here
    // This is a placeholder for admin functionality
    return ResponseUtil.success(
      { message: 'Bulk generation initiated' },
      'Bulk recommendation generation started'
    );
  }

  /**
   * Get trending recommendations (public endpoint)
   */
  @Get('trending')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getTrendingRecommendations(
    @Query() filters: GetRecommendationsDto,
  ) {
    // Implementation for public trending recommendations
    const result = await this.recommendationService.getTrendingMovies(filters);
    return ResponseUtil.success(result, 'Trending movies retrieved successfully');
  }
}
