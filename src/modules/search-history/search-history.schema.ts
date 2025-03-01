import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User, USER_MODEL_NAME } from "@/modules/auth/user.schema";

export const SEARCH_HISTORY_MODEL_NAME = 'SearchHistory';

@Schema({ timestamps: true, collection: SEARCH_HISTORY_MODEL_NAME })
export class SearchHistory extends Document {
  @Prop({
    type: Types.ObjectId,
    refPath: USER_MODEL_NAME,
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