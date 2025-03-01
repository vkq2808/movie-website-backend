import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EPISODE_SERVER_MODEL_NAME, EpisodeServerSchema } from "./episode-server.schema";
import { EpisodeServerController } from "./episode-server.controller";
import { EpisodeServerService } from "./episode-server.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: EPISODE_SERVER_MODEL_NAME, schema: EpisodeServerSchema }
    ])
  ],
  controllers: [EpisodeServerController],
  providers: [EpisodeServerService]
})
export class EpisodeServerModule { }