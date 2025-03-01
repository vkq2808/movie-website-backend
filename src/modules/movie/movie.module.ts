import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MOVIE_MODEL_NAME, MovieSchema } from "@/modules";
import { MovieController } from "./movie.controller";
import { MovieService } from "./movie.service";


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MOVIE_MODEL_NAME, schema: MovieSchema },
    ]),
  ],
  providers: [MovieService],
  controllers: [MovieController],
})

export class MovieModule { }