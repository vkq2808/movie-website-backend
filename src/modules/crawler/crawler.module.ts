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
    ]),
    LanguageModule,
  ],
  providers: [
    MovieCrawlerService,
    AlternativeTitleService,
    AlternativeOverviewService,
  ],
  exports: [MovieCrawlerService],
})
export class CrawlerModule { }
