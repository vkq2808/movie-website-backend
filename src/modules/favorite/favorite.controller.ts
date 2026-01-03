import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TokenPayload } from '@/common/token-payload.type';
import type { Request as ExpressRequest } from 'express';
import { ResponseUtil } from '@/common';

interface RequestWithUser extends ExpressRequest {
  user: TokenPayload;
}

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  /**
   * Check favorite status for a movie
   *
   * GET /api/v1/favorites/status?movieId=:id
   *
   * @param movieId - UUID of the movie (query parameter)
   * @param req - Express request with user from JWT
   * @returns { isFavorite: boolean }
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getFavoriteStatus(
    @Query('movieId') movieId: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.sub;
    const isFavorite = await this.favoriteService.isFavorite(userId, movieId);
    return ResponseUtil.success({ isFavorite });
  }

  /**
   * Toggle favorite status for a movie
   *
   * POST /api/v1/favorites/toggle
   *
   * @param dto - Contains movieId (UUID)
   * @param req - Express request with user from JWT
   * @returns { isFavorite: boolean }
   */
  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(
    @Body() dto: ToggleFavoriteDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.sub;
    const result = await this.favoriteService.toggleFavorite(
      userId,
      dto.movieId,
    );
    return ResponseUtil.success(result, 'Favorite status toggled');
  }
}
