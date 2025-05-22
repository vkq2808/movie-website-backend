import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EpisodeServerController } from "./episode-server.controller";
import { EpisodeServerService } from "./episode-server.service";
import { EpisodeServer } from "./episode-server.entity";
import { Episode } from "../episode/episode.entity";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([EpisodeServer, Episode]),
  ],
  controllers: [EpisodeServerController],
  providers: [EpisodeServerService]
})
export class EpisodeServerModule { }