import { modelNames } from "@/common/constants/model-name.constant";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";


@Schema({ timestamps: true, collection: modelNames.FEEDBACK_MODEL_NAME })
export class Feedback extends Document<Types.ObjectId> {
  @Prop({
    type: Types.ObjectId,
    ref: modelNames.USER_MODEL_NAME,
    required: [true, 'UserId is required']
  })
  user: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: modelNames.MOVIE_MODEL_NAME,
    required: true,
  })
  movie: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  feedback: string;
}

const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.pre('find', function () {
  this.populate({ path: 'movie' });
  this.populate({ path: 'user' });
});

FeedbackSchema.pre('findOne', function () {
  this.populate({ path: 'movie' });
  this.populate({ path: 'user' });
});

export { FeedbackSchema };