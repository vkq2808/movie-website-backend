import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Movie } from "./movie.entity";
import { MovieController } from "./movie.controller";
import { MovieService } from "./movie.service";
import { Genre } from "../genre/genre.entity";
import { Image } from "../image/image.entity";
import { Video } from "../video/video.entity";
import { Language } from "../language/language.entity";
import { LanguageModule } from "../language/language.module";
import { AlternativeTitle } from "./alternative-title.entity";
import { AlternativeTitleService } from "./alternative-title.service";
import { AlternativeOverview } from "./alternative-overview.entity";
import { AlternativeOverviewService } from "./alternative-overview.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Movie, Genre, Image, Video, Language, AlternativeOverview, AlternativeTitle]),
    LanguageModule
  ],
  controllers: [MovieController],
  providers: [MovieService, AlternativeOverviewService, AlternativeTitleService],
  exports: [MovieService, AlternativeTitleService]
})
export class MovieModule { }