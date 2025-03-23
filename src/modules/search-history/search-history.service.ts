import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { SearchHistory } from "./search-history.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectModel(modelNames.SEARCH_HISTORY_MODEL_NAME)
    private readonly searchHistoryModel: Model<SearchHistory>
  ) { }
}