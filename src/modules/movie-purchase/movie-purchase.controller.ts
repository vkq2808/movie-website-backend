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
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MoviePurchaseService } from './movie-purchase.service';
import { PurchaseMovieDto } from './movie-purchase.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import type { Request as ExpressRequest } from 'express';
import type { TokenPayload } from '@/common/token-payload.type';
import { WatchPartyService } from '../watch-party/watch-party.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RequestWithOptionalUser } from '../auth/auth.interface';

@Controller('movie-purchase')
export class MoviePurchaseController {
  constructor(
    private readonly moviePurchaseService: MoviePurchaseService,
    private readonly watchPartyService: WatchPartyService,
  ) { }

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
    @Param('movieId', new ParseUUIDPipe({ version: '4' })) movieId: string,
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

  /**
   * UNIFIED PERMISSION LOGIC (FIX ISSUE-02)
   * Endpoint to check if user can watch a movie
   * Returns canWatch status and reason why they can't watch
   * Used by frontend to make authorization decisions
   */
  @Get('can-watch/:movieId')
  @UseGuards(OptionalJwtAuthGuard)
  async canWatchMovie(
    @Req() req: RequestWithOptionalUser,
    @Param('movieId', new ParseUUIDPipe({ version: '4' })) movieId: string,
  ) {
    const user = req.user;

    // Not logged in
    if (!user) {
      return ResponseUtil.success(
        { canWatch: false, reason: 'NOT_LOGIN' },
        'User is not logged in',
      );
    }

    // Check if user has purchase
    const hasPurchased = await this.moviePurchaseService.checkIfUserOwnMovie(
      user.sub,
      movieId,
    );

    if (hasPurchased) {
      return ResponseUtil.success(
        { canWatch: true },
        'User has purchased the movie',
      );
    }

    // Check if user has watch party ticket
    const hasWatchPartyTicket =
      await this.watchPartyService.checkTicketPurchased(user.sub, movieId);

    if (hasWatchPartyTicket) {
      return ResponseUtil.success(
        { canWatch: true },
        'User has a valid watch party ticket',
      );
    }

    // User logged in but no permission
    return ResponseUtil.success(
      { canWatch: false, reason: 'NOT_PURCHASED' },
      'User has not purchased the movie',
    );
  }
}
