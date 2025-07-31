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
   * Get personalized recommendations for the current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getRecommendations(
    @Request() req: any,
    @Query() filters: GetRecommendationsDto,
  ) {
    const userId = req.user.sub;
    const result = await this.recommendationService.getRecommendations(userId, filters);

    return ResponseUtil.success(result, 'Recommendations retrieved successfully');
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
