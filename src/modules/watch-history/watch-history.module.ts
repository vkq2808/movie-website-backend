import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { WatchHistory, WatchHistorySchema } from "./watch-history.schema";
import { WatchHistoryController } from "./watch-history.controller";
import { WatchHistoryService } from "./watch-history.service";
import { modelNames } from "@/common/constants/model-name.constant";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: modelNames.WATCH_HISTORY_MODEL_NAME, schema: WatchHistorySchema }
    ])
  ],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService]
})
export class WatchHistoryModule { }