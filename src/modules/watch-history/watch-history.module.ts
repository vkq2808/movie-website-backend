import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { WatchHistory, WatchHistorySchema } from "./watch-history.schema";
import { WatchHistoryController } from "./watch-history.controller";
import { WatchHistoryService } from "./watch-history.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WatchHistory.name, schema: WatchHistorySchema }
    ])
  ],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService]
})
export class WatchHistoryModule { }