import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { Video } from './video.entity';
import { Movie } from '../movie/entities/movie.entity';
import { WatchProviderModule } from '../watch-provider/watch-provider.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Video, Movie]),
    WatchProviderModule
  ],
  controllers: [
    VideoController
  ],
  providers: [
    VideoService
  ],
  exports: [
    VideoService
  ]
})
export class VideoModule { }
