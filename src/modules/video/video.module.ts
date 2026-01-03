import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { Video } from './video.entity';
import { Movie } from '../movie/entities/movie.entity';
import { WatchProviderModule } from '../watch-provider/watch-provider.module';
import { MoviePurchaseModule } from '../movie-purchase/movie-purchase.module';
import { WatchPartyModule } from '../watch-party/watch-party.module';
import { WatchHistoryModule } from '../watch-history/watch-history.module';
import { MovieViewLog } from './entities/movie-view-log.entity';
import { User } from '../user/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Video,
      Movie,
      MovieViewLog,
      User
    ]),
    WatchProviderModule,
    MoviePurchaseModule,
    WatchPartyModule,
    WatchHistoryModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule { }
