import {
  Controller,
  UseGuards,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  Request,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { WatchHistoryService } from './watch-history.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { ResponseUtil } from '@/common/utils/response.util';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsString,
  IsOptional,
} from 'class-validator';
import { TokenPayload } from '@/common/token-payload.type';

type AuthenticatedRequest = Request & { user: TokenPayload };

class AddWatchHistoryDto {
  @IsNotEmpty()
  @IsString()
  movieId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;
}

class GetWatchHistoryDto {
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;
}

@Controller('watch-history')
@UseGuards(JwtAuthGuard)
export class WatchHistoryController {
  constructor(private readonly watchHistoryService: WatchHistoryService) {}

  /**
   * Add or update watch history
   */
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async addWatchHistory(
    @Request() req: AuthenticatedRequest,
    @Body() addWatchHistoryDto: AddWatchHistoryDto,
  ) {
    const userId = req.user.sub;
    const watchHistory = await this.watchHistoryService.addWatchHistory(
      userId,
      addWatchHistoryDto.movieId,
      addWatchHistoryDto.progress,
    );

    return ResponseUtil.success(
      watchHistory,
      'Watch history updated successfully',
    );
  }

  /**
   * Get user's watch history
   */
  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUserWatchHistory(
    @Request() req: AuthenticatedRequest,
    @Query() query: GetWatchHistoryDto,
  ) {
    const userId = req.user.sub;
    const result = await this.watchHistoryService.getUserWatchHistory(
      userId,
      query.limit,
      query.page,
    );

    return ResponseUtil.success(result, 'Watch history retrieved successfully');
  }

  /**
   * Get recently watched movies
   */
  @Get('recent')
  async getRecentlyWatched(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.sub;
    const movies = await this.watchHistoryService.getRecentlyWatched(
      userId,
      limit,
    );

    return ResponseUtil.success(
      movies,
      'Recently watched movies retrieved successfully',
    );
  }

  /**
   * Get watch progress for a specific movie
   */
  @Get('progress/:movieId')
  async getWatchProgress(
    @Request() req: AuthenticatedRequest,
    @Param('movieId') movieId: string,
  ) {
    const userId = req.user.sub;
    const progress = await this.watchHistoryService.getWatchProgress(
      userId,
      movieId,
    );

    return ResponseUtil.success(
      { progress },
      'Watch progress retrieved successfully',
    );
  }

  /**
   * Get user's watch statistics
   */
  @Get('stats')
  async getUserWatchStats(@Request() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const stats = await this.watchHistoryService.getUserWatchStats(userId);

    return ResponseUtil.success(
      stats,
      'Watch statistics retrieved successfully',
    );
  }

  /**
   * Delete specific watch history entry
   */
  @Delete(':movieId')
  async deleteWatchHistory(
    @Request() req: AuthenticatedRequest,
    @Param('movieId') movieId: string,
  ) {
    const userId = req.user.sub;
    await this.watchHistoryService.deleteWatchHistory(userId, movieId);

    return ResponseUtil.success(null, 'Watch history deleted successfully');
  }

  /**
   * Clear all watch history
   */
  @Delete()
  async clearWatchHistory(@Request() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    await this.watchHistoryService.clearUserWatchHistory(userId);

    return ResponseUtil.success(null, 'All watch history cleared successfully');
  }
}
