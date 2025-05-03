import { modelNames } from "@/common/constants/model-name.constant";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true, collection: modelNames.SEARCH_HISTORY_MODEL_NAME })
export class SearchHistory extends Document<Types.ObjectId> {
  @Prop({
    type: Types.ObjectId,
    ref: modelNames.USER_MODEL_NAME,
    required: [true, "User is required"],
  })
  user: Types.ObjectId;

  @Prop({
    type: String,
    required: [true, "Search query is required"],
  })
  search_query: string;
}

const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory)

export { SearchHistorySchema };