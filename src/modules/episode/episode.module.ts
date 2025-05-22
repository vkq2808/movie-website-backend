import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EpisodeController } from "./episode.controller";
import { EpisodeService } from "./episode.service";
import { Episode } from "./episode.entity";
import { Movie } from "../movie/movie.entity";
import { EpisodeServer } from "../episode-server/episode-server.entity";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Episode, Movie, EpisodeServer]),
  ],
  controllers: [EpisodeController],
  providers: [EpisodeService]
})
export class EpisodeModule { }