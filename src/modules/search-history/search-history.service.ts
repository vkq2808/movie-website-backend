import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { SearchHistory, SEARCH_HISTORY_MODEL_NAME } from "./search-history.schema";

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectModel(SEARCH_HISTORY_MODEL_NAME)
    private readonly searchHistoryModel: Model<SearchHistory>
  ) { }
}