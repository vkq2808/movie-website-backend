import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MovieController } from "./movie.controller";
import { MovieService } from "./movie.service";
import { modelNames } from "@/common/constants/model-name.constant";
import { MovieSchema } from "./movie.schema";


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: modelNames.MOVIE_MODEL_NAME, schema: MovieSchema },
    ]),
  ],
  providers: [MovieService],
  controllers: [MovieController],
})

export class MovieModule { }