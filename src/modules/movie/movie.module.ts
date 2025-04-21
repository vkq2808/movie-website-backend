import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MovieController } from "./movie.controller";
import { MovieService } from "./movie.service";
import { modelNames } from "@/common/constants/model-name.constant";
import { MovieSchema } from "./movie.schema";
import { GenreSchema } from "../genre/genre.schema";
import { GenreModule } from "../genre/genre.module";
import { ImageSchema } from "../image/image.schema";


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: modelNames.MOVIE_MODEL_NAME, schema: MovieSchema },
      { name: modelNames.GENRE_MODEL_NAME, schema: GenreSchema },
      { name: modelNames.IMAGE_MODEL_NAME, schema: ImageSchema },
    ]),
    GenreModule
  ],
  providers: [MovieService],
  controllers: [MovieController],
})

export class MovieModule { }