import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
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
import { MoviePurchaseService } from '../movie-purchase/movie-purchase.service';
import { JwtAuthGuard, RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums';
import {
  CreateFeedbackDto,
  GetCommentsQueryDto,
  UpdateFeedbackDto,
} from './feedback.dto';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Movie } from '../movie/entities/movie.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import { SanitizationPipe } from '@/common/pipes/sanitization.pipe';
import { ResourcesNotFoundException } from '@/exceptions';

@Controller('feedback')
export class FeedbackController {
  private readonly logger = new Logger(FeedbackController.name);

  constructor(
    private readonly feedbackService: FeedbackService,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly purchaseService: MoviePurchaseService,
  ) { }

  @Post(':movieId')
  @RateLimit({ points: 5, duration: 60 }) // 5 comments per minute
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @UsePipes(
    new SanitizationPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(
    @Param('movieId', new ParseUUIDPipe({ version: '4' })) movieId: string,
    @Body() body: CreateFeedbackDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    try {
      // Ensure path param and body movie_id match if body sent
      const movie = await this.movieRepository.findOne({
        where: { id: movieId },
      });
      if (!movie) {
        throw new ResourcesNotFoundException('Movie not found');
      }
      const user = await this.userRepository.findOne({
        where: { id: req.user.sub },
      });
      if (!user) {
        throw new ResourcesNotFoundException('User not found');
      }
      // Ensure user actually purchased the movie before allowing feedback
      const hasPurchased = await this.purchaseService.checkIfUserOwnMovie(
        req.user.sub,
        movieId,
      );
      if (!hasPurchased) {
        throw new ForbiddenException('You must purchase the movie to leave feedback');
      }

      const created = await this.feedbackService.create({
        feedback: body.feedback,
        movie,
        user,
      });
      return created;
    } catch (error) {
      this.logger.error(
        `Failed to create feedback for movie ${movieId} by user ${req.user.sub}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('movie/:movieId')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getByMovie(
    @Param('movieId', new ParseUUIDPipe()) movieId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    try {
      const take = Math.min(Math.max(query.limit || 10, 1), 50);
      const page = Math.max(query.page || 1, 1);
      const skip = (page - 1) * take;
      const [items, total] = await this.feedbackService.findByMovieIdPaginated(
        movieId,
        { skip, take },
      );

      return {
        success: true,
        data: items,
        pagination: {
          page,
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get feedback for movie ${movieId}`,
        error.stack,
      );
      throw error;
    }
  }

  @Patch(':id')
  @RateLimit({ points: 10, duration: 60 }) // 10 updates per minute
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @UsePipes(
    new SanitizationPipe(),
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
    try {
      const existing = await this.feedbackService.findById(id);
      if (!existing) {
        throw new ResourcesNotFoundException('Feedback not found');
      }
      if (existing.user.id !== req.user.sub) {
        throw new ForbiddenException('You cannot edit this feedback');
      }
      const user = await this.userRepository.findOne({
        where: { id: req.user.sub },
      });
      if (!user) {
        throw new ResourcesNotFoundException('User not found');
      }
      const updated = await this.feedbackService.update(
        id,
        user,
        false, // isAdmin = false for regular users
        {
          feedback: body.feedback,
        },
      );
      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update feedback ${id} by user ${req.user.sub}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @RateLimit({ points: 10, duration: 60 }) // 10 deletes per minute
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    try {
      const existing = await this.feedbackService.findById(id);
      if (!existing) {
        throw new ResourcesNotFoundException('Feedback not found');
      }
      if (existing.user.id !== req.user.sub) {
        throw new ForbiddenException('You cannot delete this feedback');
      }
      const user = await this.userRepository.findOne({
        where: { id: req.user.sub },
      });
      if (!user) {
        throw new ResourcesNotFoundException('User not found');
      }
      await this.feedbackService.delete(
        id,
        user,
        false, // isAdmin = false for regular users
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove feedback ${id} by user ${req.user.sub}`,
        error.stack,
      );
      throw error;
    }
  }
}
