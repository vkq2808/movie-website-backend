import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entities/movie.entity';
import { MovieController } from './movie.controller';
import { MovieService } from './services/movie.service';
import { KeywordModule } from '../keyword/keyword.module';
import { GenreModule } from '../genre/genre.module';
import { LanguageModule } from '../language/language.module';
import { MovieCast } from './entities/movie-cast.entity';
import { MovieCrew } from './entities/movie-crew.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Movie,
      MovieCast,
      MovieCrew
    ]),
    KeywordModule,
    GenreModule,
    LanguageModule
  ],
  controllers: [MovieController],
  providers: [MovieService],
  exports: [MovieService],
})
export class MovieModule { }
