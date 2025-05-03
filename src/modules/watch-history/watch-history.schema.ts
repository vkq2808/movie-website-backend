import { modelNames } from "@/common/constants/model-name.constant";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true, collection: modelNames.WATCH_HISTORY_MODEL_NAME })
export class WatchHistory extends Document<Types.ObjectId> {
  @Prop({
    type: Types.ObjectId,
    ref: modelNames.USER_MODEL_NAME,
    required: [true, "User is required"],
  })
  user: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: [true, "Movie is required"],
  })
  movie: Types.ObjectId;

  @Prop({
    type: Number,
    required: [true, "Progress is required"],
  })
  progress: number;
}

const WatchHistorySchema = SchemaFactory.createForClass(WatchHistory);

WatchHistorySchema.pre('find', function () {
  this.populate({ path: 'movie' });
});

WatchHistorySchema.pre('findOne', function () {
  this.populate({ path: 'movie' });
});

export { WatchHistorySchema };