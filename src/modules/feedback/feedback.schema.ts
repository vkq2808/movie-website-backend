import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { MOVIE_MODEL_NAME } from "@/modules/movie/movie.schema";
import { USER_MODEL_NAME } from "@/modules/auth/user.schema";

export const FEEDBACK_MODEL_NAME = 'Feedback';

@Schema({ timestamps: true, collection: FEEDBACK_MODEL_NAME })
export class Feedback extends Document {
  @Prop({
    type: Types.ObjectId,
    refPath: USER_MODEL_NAME,
    required: [true, 'UserId is required']
  })
  user: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    refPath: MOVIE_MODEL_NAME,
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