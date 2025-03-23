import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EpisodeSchema } from "./episode.schema";
import { EpisodeService } from "./episode.service";
import { EpisodeController } from "./episode.controller";
import { modelNames } from "@/common/constants/model-name.constant";


@Module({
  imports: [
    MongooseModule.forFeature([{ name: modelNames.EPISODE_MODEL_NAME, schema: EpisodeSchema }]),
  ],
  providers: [EpisodeService],
  controllers: [EpisodeController]
})

export class EpisodeModule { }