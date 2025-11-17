import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MoviePurchaseService } from './movie-purchase.service';
import { PurchaseMovieDto } from './movie-purchase.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import type { Request as ExpressRequest } from 'express';
import type { TokenPayload } from '@/common/token-payload.type';

@Controller('movie-purchase')
export class MoviePurchaseController {
  constructor(private readonly moviePurchaseService: MoviePurchaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async purchaseMovie(
    @Request() req: ExpressRequest & { user: TokenPayload },
    @Body() purchaseMovieDto: PurchaseMovieDto,
  ) {
    const purchase = await this.moviePurchaseService.purchaseMovie(
      req.user.sub,
      purchaseMovieDto,
    );

    return ResponseUtil.success(purchase, 'Movie purchased successfully');
  }

  @Get()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  async getUserPurchases(
    @Request() req: ExpressRequest & { user: TokenPayload },
  ) {
    const purchases = await this.moviePurchaseService.getUserPurchases(
      req.user.sub,
    );

    return ResponseUtil.success(
      purchases,
      'User purchases retrieved successfully',
    );
  }

  @Get(':purchaseId')
  @UseGuards(JwtAuthGuard)
  async getPurchaseDetails(
    @Request() req: ExpressRequest & { user: TokenPayload },
    @Param('purchaseId') purchaseId: string,
  ) {
    const purchase = await this.moviePurchaseService.getPurchaseDetails(
      req.user.sub,
      purchaseId,
    );

    return ResponseUtil.success(
      purchase,
      'Purchase details retrieved successfully',
    );
  }

  @Get('check/:movieId')
  @UseGuards(JwtAuthGuard)
  async checkMovieOwnership(
    @Request() req: ExpressRequest & { user: TokenPayload },
    @Param('movieId') movieId: string,
  ) {
    const ownsMovie = await this.moviePurchaseService.checkIfUserOwnMovie(
      req.user.sub ?? '',
      movieId,
    );

    return ResponseUtil.success(
      { owns_movie: ownsMovie },
      'Movie ownership checked successfully',
    );
  }
}
