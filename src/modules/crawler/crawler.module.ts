import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Movie } from '../movie/entities/movie.entity';
import { Genre } from '../genre/genre.entity';
import { Image } from '../image/image.entity';
import { Video } from '../video/video.entity';
import { Language } from '../language/language.entity';
import { LanguageModule } from '../language/language.module';
import { MovieCrawlerService } from './services/movie.crawler.service';
import { KeywordCrawlerService } from './services/keyword.crawler.service';
import { GenreCrawlerService } from './services/genre.crawler.service';
import { LanguageCrawlerService } from './services/language.crawler.service';
import { TranslationCrawlerService } from './services/translation.crawler.service';
import { ExternalIdsCrawlerService } from './services/external-ids.crawler.service';
import { CreditsCrawlerService } from './services/credits.crawler.service';
import { Person } from '../person/person.entity';
import { MovieCast } from '../movie/entities/movie-cast.entity';
import { MovieCrew } from '../movie/entities/movie-crew.entity';
import { Keyword } from '../keyword/keyword.entity';
import { WatchProvider } from '../watch-provider/watch-provider.entity';
import { MovieWatchProvider } from '../watch-provider/movie-watch-provider.entity';
import { WatchProviderModule } from '../watch-provider/watch-provider.module';
import { WatchProviderService } from '../watch-provider/watch-provider.service';
import { ProductionCompanyCrawlerService } from './services/production-company.crawler.service';
import { ProductionCompany } from '../production-company/production-company.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Movie,
      Genre,
      Image,
      Video,
      Language,
      Person,
      MovieCast,
      MovieCrew,
      Keyword,
      WatchProvider,
      MovieWatchProvider,
      ProductionCompany
    ]),
    LanguageModule,
    WatchProviderModule,
  ],
  providers: [
    MovieCrawlerService,
    KeywordCrawlerService,
    GenreCrawlerService,
    LanguageCrawlerService,
    CreditsCrawlerService,
    ExternalIdsCrawlerService,
    TranslationCrawlerService,
    WatchProviderService,
    ProductionCompanyCrawlerService
  ],
  exports: [
    MovieCrawlerService,
    KeywordCrawlerService,
    GenreCrawlerService,
    LanguageCrawlerService,
    CreditsCrawlerService,
    ExternalIdsCrawlerService,
    TranslationCrawlerService,
    WatchProviderService,
    ProductionCompanyCrawlerService
  ],
})
export class CrawlerModule { }
