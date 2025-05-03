import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { WatchHistory } from "./watch-history.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectModel(modelNames.WATCH_HISTORY_MODEL_NAME)
    private readonly watchHistoryModel: Model<WatchHistory>
  ) { }
}