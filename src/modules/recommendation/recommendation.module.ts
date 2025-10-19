import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { RecommendationTaskService } from './recommendation-task.service';
import { Recommendation } from './recommendation.entity';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { WatchHistory } from '../watch-history/watch-history.entity';
import { MoviePurchase } from '../movie-purchase/movie-purchase.entity';
import { Genre } from '../genre/genre.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Recommendation,
      User,
      Movie,
      WatchHistory,
      MoviePurchase,
      Genre,
    ]),
  ],
  controllers: [RecommendationController],
  providers: [RecommendationService, RecommendationTaskService],
  exports: [RecommendationService],
})
export class RecommendationModule { }
