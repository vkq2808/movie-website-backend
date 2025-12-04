import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Feedback } from './feedback.entity';
import { Movie } from '../movie/entities/movie.entity';
import { User } from '../user/user.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { RateLimitInterceptor } from '@/common/interceptors/rate-limit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Feedback, Movie, User]),
  ],
  controllers: [FeedbackController],
  providers: [
    FeedbackService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
})
export class FeedbackModule { }
