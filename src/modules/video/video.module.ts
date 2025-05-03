import { Module } from "@nestjs/common";
import { VideoService } from "./video.service";
import { VideoController } from "./video.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { modelNames } from "@/common/constants/model-name.constant";
import { VideoSchema } from "./video.schema";
import { MovieSchema } from "../movie/movie.schema";


@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: modelNames.VIDEO_MODEL_NAME,
        schema: VideoSchema,
        collection: modelNames.VIDEO_MODEL_NAME,
      },
      {
        name: modelNames.MOVIE_MODEL_NAME,
        schema: MovieSchema,
        collection: modelNames.MOVIE_MODEL_NAME,
      },
    ])
  ],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [],
})
export class VideoModule { }