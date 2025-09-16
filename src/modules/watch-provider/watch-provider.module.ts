import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchProvider } from './watch-provider.entity';
import { MovieWatchProvider } from './movie-watch-provider.entity';
import { WatchProviderService } from './watch-provider.service';
import { MovieWatchProviderService } from './movie-watch-provider.service';
import { WatchProviderController } from './watch-provider.controller';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WatchProvider, MovieWatchProvider, Movie]),
  ],
  controllers: [WatchProviderController],
  providers: [WatchProviderService, MovieWatchProviderService],
  exports: [WatchProviderService, MovieWatchProviderService],
})
export class WatchProviderModule { }
