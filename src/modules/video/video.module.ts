import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { Video } from "./video.entity";
import { Movie } from "../movie/movie.entity";


@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Video, Movie]),
  ],
  controllers: [VideoController],
  providers: [VideoService]
})
export class VideoModule { }