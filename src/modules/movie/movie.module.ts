import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Movie } from "./movie.entity";
import { MovieController } from "./movie.controller";
import { MovieService } from "./movie.service";
import { Genre } from "../genre/genre.entity";
import { Image } from "../image/image.entity";
import { Video } from "../video/video.entity";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Movie, Genre, Image, Video])
  ],
  controllers: [MovieController],
  providers: [MovieService],
  exports: [MovieService]
})
export class MovieModule { }