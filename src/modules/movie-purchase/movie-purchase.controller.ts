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

@Controller('movie-purchases')
export class MoviePurchaseController {
  constructor(private readonly moviePurchaseService: MoviePurchaseService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async purchaseMovie(
    @Request() req: any,
    @Body() purchaseMovieDto: PurchaseMovieDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: MoviePurchaseResponseDto;
  }> {
    const purchase = await this.moviePurchaseService.purchaseMovie(
      req.user.sub,
      purchaseMovieDto,
    );

    return {
      success: true,
      message: 'Movie purchased successfully',
      data: purchase,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserPurchases(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
    data: MoviePurchaseResponseDto[];
  }> {
    const purchases = await this.moviePurchaseService.getUserPurchases(req.user.sub);

    return {
      success: true,
      message: 'User purchases retrieved successfully',
      data: purchases,
    };
  }

  @Get(':purchaseId')
  @UseGuards(JwtAuthGuard)
  async getPurchaseDetails(
    @Request() req: any,
    @Param('purchaseId') purchaseId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: MoviePurchaseResponseDto;
  }> {
    const purchase = await this.moviePurchaseService.getPurchaseDetails(
      req.user.sub,
      purchaseId,
    );

    return {
      success: true,
      message: 'Purchase details retrieved successfully',
      data: purchase,
    };
  }

  @Get('check/:movieId')
  async checkMovieOwnership(
    @Request() req: any,
    @Param('movieId') movieId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: { owns_movie: boolean };
  }> {
    const ownsMovie = await this.moviePurchaseService.checkIfUserOwnMovie(
      req.user?.sub,
      movieId,
    );

    return {
      success: true,
      message: 'Movie ownership checked successfully',
      data: { owns_movie: ownsMovie },
    };
  }
}
