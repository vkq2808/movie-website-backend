import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchProvider } from './watch-provider.entity';
import { WatchProviderService } from './watch-provider.service';
import { WatchProviderController } from './watch-provider.controller';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WatchProvider, Movie]),
  ],
  controllers: [WatchProviderController],
  providers: [WatchProviderService],
  exports: [WatchProviderService],
})
export class WatchProviderModule { }
