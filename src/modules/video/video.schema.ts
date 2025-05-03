import { modelNames } from "@/common/constants/model-name.constant";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true, collection: modelNames.VIDEO_MODEL_NAME })
export class Video extends Document<Types.ObjectId> {
  @Prop({ type: Types.ObjectId, ref: modelNames.MOVIE_MODEL_NAME })
  movieId: Types.ObjectId;

  @Prop({ type: String, required: true })
  iso_649_1: string;

  @Prop({ type: String, required: true })
  iso_3166_1: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  site: string;

  @Prop({ type: Number })
  size: number;

  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: Boolean, default: false })
  official: boolean;

  @Prop({ type: Date })
  publishedAt: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);