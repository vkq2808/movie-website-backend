import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entities/movie.entity';
import { MovieController } from './movie.controller';
import { MovieService } from './services/movie.service';
import { Genre } from '../genre/genre.entity';
import { Image } from '../image/image.entity';
import { Video } from '../video/video.entity';
import { Language } from '../language/language.entity';
import { LanguageModule } from '../language/language.module';
import { AlternativeTitle } from './entities/alternative-title.entity';
import { AlternativeTitleService } from './services/alternative-title.service';
import { AlternativeOverview } from './entities/alternative-overview.entity';
import { AlternativeOverviewService } from './services/alternative-overview.service';
import { Keyword } from '../keyword/keyword.entity';
import { ProductionCompany } from '../production-company/production-company.entity';
import { MovieCast } from './entities/movie-cast.entity';
import { MovieCrew } from './entities/movie-crew.entity';
import { WatchProviderModule } from '../watch-provider/watch-provider.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Movie,
      Genre,
      Keyword,
      ProductionCompany,
      MovieCast,
      MovieCrew,
      Image,
      Video,
      Language,
      AlternativeOverview,
      AlternativeTitle,
    ]),
    LanguageModule,
    WatchProviderModule,
  ],
  controllers: [MovieController],
  providers: [
    MovieService,
    AlternativeOverviewService,
    AlternativeTitleService,
  ],
  exports: [MovieService, AlternativeTitleService],
})
export class MovieModule {}
