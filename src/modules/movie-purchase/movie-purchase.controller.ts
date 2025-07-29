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
import { PurchaseMovieDto, MoviePurchaseResponseDto } from './movie-purchase.dto';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('movie-purchases')
export class MoviePurchaseController {
  constructor(private readonly moviePurchaseService: MoviePurchaseService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async purchaseMovie(
    @Request() req: any,
    @Body() purchaseMovieDto: PurchaseMovieDto,
  ) {
    const purchase = await this.moviePurchaseService.purchaseMovie(
      req.user.sub,
      purchaseMovieDto,
    );

    return ResponseUtil.success(purchase, 'Movie purchased successfully');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserPurchases(
    @Request() req: any,
  ) {
    const purchases = await this.moviePurchaseService.getUserPurchases(req.user.sub);

    return ResponseUtil.success(purchases, 'User purchases retrieved successfully');
  }

  @Get(':purchaseId')
  @UseGuards(JwtAuthGuard)
  async getPurchaseDetails(
    @Request() req: any,
    @Param('purchaseId') purchaseId: string,
  ) {
    const purchase = await this.moviePurchaseService.getPurchaseDetails(
      req.user.sub,
      purchaseId,
    );

    return ResponseUtil.success(purchase, 'Purchase details retrieved successfully');
  }

  @Get('check/:movieId')
  async checkMovieOwnership(
    @Request() req: any,
    @Param('movieId') movieId: string,
  ) {
    const ownsMovie = await this.moviePurchaseService.checkIfUserOwnMovie(
      req.user?.sub,
      movieId,
    );

    return ResponseUtil.success({ owns_movie: ownsMovie }, 'Movie ownership checked successfully');
  }
}
