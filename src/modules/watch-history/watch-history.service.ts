import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { WatchHistory, WATCH_HISTORY_MODEL_NAME } from "./watch-history.schema";

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectModel(WATCH_HISTORY_MODEL_NAME)
    private readonly watchHistoryModel: Model<WatchHistory>
  ) { }
}