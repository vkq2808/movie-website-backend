import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EpisodeServerSchema } from "./episode-server.schema";
import { EpisodeServerController } from "./episode-server.controller";
import { EpisodeServerService } from "./episode-server.service";
import { modelNames } from "@/common/constants/model-name.constant";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: modelNames.EPISODE_SERVER_MODEL_NAME, schema: EpisodeServerSchema }
    ])
  ],
  controllers: [EpisodeServerController],
  providers: [EpisodeServerService]
})
export class EpisodeServerModule { }