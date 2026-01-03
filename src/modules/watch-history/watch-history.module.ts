import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WatchHistoryController } from './watch-history.controller';
import { WatchHistoryService } from './watch-history.service';
import { WatchHistory } from './watch-history.entity';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([WatchHistory, User, Movie]),
  ],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService],
  exports: [WatchHistoryService],
})
export class WatchHistoryModule {}
