import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import {
  CreateFeedbackDto,
  GetCommentsQueryDto,
  UpdateFeedbackDto,
} from './feedback.dto';
import { Request } from 'express';
import { ResponseUtil } from '@/common/utils/response.util';
import { Repository } from 'typeorm';
import { Movie } from '../movie/entities/movie.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/user.entity';
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  @Post(':movieId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(
    @Param('movieId', new ParseUUIDPipe()) movieId: string,
    @Body() body: CreateFeedbackDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    // Ensure path param and body movie_id match if body sent
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
    });
    if (!movie) {
      return ResponseUtil.error('Movie not found');
    }
    const user = await this.userRepository.findOne({
      where: { id: req.user.sub },
    });
    if (!user) {
      return ResponseUtil.error('User not found');
    }
    const created = await this.feedbackService.create({
      feedback: body.feedback,
      movie,
      user,
    });
    return ResponseUtil.success(created, 'Comment created');
  }

  @Get('movie/:movieId')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getByMovie(
    @Param('movieId', new ParseUUIDPipe()) movieId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    const take = Math.min(Math.max(query.limit || 10, 1), 50);
    const page = Math.max(query.page || 1, 1);
    const skip = (page - 1) * take;
    const [items, total] = await this.feedbackService.findByMovieIdPaginated(
      movieId,
      { skip, take },
    );
    return ResponseUtil.paginated(items, page, take, total, 'Comments fetched');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateFeedbackDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const existing = await this.feedbackService.findById(id);
    if (!existing) return ResponseUtil.error('Comment not found');
    if (existing.user.id !== req.user.sub)
      return ResponseUtil.error('Forbidden');
    const updated = await this.feedbackService.update(id, {
      feedback: body.feedback,
    });
    return ResponseUtil.success(updated, 'Comment updated');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const existing = await this.feedbackService.findById(id);
    if (!existing) return ResponseUtil.error('Comment not found');
    if (existing.user.id !== req.user.sub)
      return ResponseUtil.error('Forbidden');
    await this.feedbackService.delete(id);
    return ResponseUtil.success(null, 'Comment deleted');
  }
}
