import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SEARCH_HISTORY_MODEL_NAME, SearchHistorySchema } from "./search-history.schema";
import { SearchHistoryService } from "./search-history.service";
import { SearchHistoryController } from "./search-history.controller";


@Module({
  imports: [MongooseModule.forFeature([
    { name: SEARCH_HISTORY_MODEL_NAME, schema: SearchHistorySchema }
  ],)
  ],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService]
})
export class SearchHistoryModule { }