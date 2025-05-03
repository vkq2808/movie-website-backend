import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SearchHistorySchema } from "./search-history.schema";
import { SearchHistoryService } from "./search-history.service";
import { SearchHistoryController } from "./search-history.controller";
import { modelNames } from "@/common/constants/model-name.constant";


@Module({
  imports: [MongooseModule.forFeature([
    { name: modelNames.SEARCH_HISTORY_MODEL_NAME, schema: SearchHistorySchema }
  ],)
  ],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService]
})
export class SearchHistoryModule { }