import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EPISODE_MODEL_NAME, EpisodeSchema } from "./episode.schema";
import { EpisodeService } from "./episode.service";
import { EpisodeController } from "./episode.controller";


@Module({
  imports: [
    MongooseModule.forFeature([{ name: EPISODE_MODEL_NAME, schema: EpisodeSchema }]),
  ],
  providers: [EpisodeService],
  controllers: [EpisodeController]
})

export class EpisodeModule { }