import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Movie } from '../movie/entities/movie.entity';
import { Genre } from '../genre/genre.entity';
import { Image } from '../image/image.entity';
import { Video } from '../video/video.entity';
import { Language } from '../language/language.entity';
import { LanguageModule } from '../language/language.module';
import { AlternativeTitle } from '../movie/entities/alternative-title.entity';
import { AlternativeOverview } from '../movie/entities/alternative-overview.entity';
import { AlternativeTitleService } from '../movie/services/alternative-title.service';
import { AlternativeOverviewService } from '../movie/services/alternative-overview.service';
import { MovieCrawlerService } from './services/movie.crawler.service';
import { Person } from '../person/person.entity';
import { MovieCast } from '../movie/entities/movie-cast.entity';
import { MovieCrew } from '../movie/entities/movie-crew.entity';
import { Keyword } from '../keyword/keyword.entity';
import { AlternativeTagline } from '../movie/entities/alternative-tagline.entity';
import { WatchProvider } from '../watch-provider/watch-provider.entity';
import { MovieWatchProvider } from '../watch-provider/movie-watch-provider.entity';
import { WatchProviderModule } from '../watch-provider/watch-provider.module';
import { WatchProviderService } from '../watch-provider/watch-provider.service';
import { MovieWatchProviderService } from '../watch-provider/movie-watch-provider.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Movie,
      Genre,
      Image,
      Video,
      Language,
      AlternativeOverview,
      AlternativeTitle,
      Person,
      MovieCast,
      MovieCrew,
      Keyword,
      AlternativeTagline,
      WatchProvider,
      MovieWatchProvider,
    ]),
    LanguageModule,
    WatchProviderModule,
  ],
  providers: [
    MovieCrawlerService,
    AlternativeTitleService,
    AlternativeOverviewService,
    WatchProviderService,
    MovieWatchProviderService,
  ],
  exports: [MovieCrawlerService],
})
export class CrawlerModule {}
