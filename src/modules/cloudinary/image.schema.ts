import { modelNames } from '@/common/constants/model-name.constant';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ResourceType {
  IMAGE = 'image',
  RAW = 'raw',
  VIDEO = 'video',
  AUTO = 'auto',
}

@Schema({ timestamps: true, collection: modelNames.IMAGE_MODEL_NAME })
export class Image extends Document {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  alt: string;

  @Prop({ type: Types.ObjectId, ref: modelNames.MOVIE_MODEL_NAME })
  movieId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  public_id: string;

  @Prop({ type: Number })
  version: number;

  @Prop({ type: String })
  signature: string;

  @Prop({ type: Number })
  width: number;

  @Prop({ type: Number })
  height: number;

  @Prop({ type: String })
  format: string;

  @Prop({ type: String, enum: ResourceType, default: ResourceType.IMAGE })
  resource_type: ResourceType;

  @Prop([{ type: String }])
  tags: Array<string>;

  @Prop({ type: Number })
  pages: number;

  @Prop({ type: Number })
  bytes: number;

  @Prop({ type: String })
  type: string;

  @Prop({ type: String })
  etag: string;

  @Prop({ type: String })
  secure_url: string;

  @Prop({ type: String })
  access_mode: string;

  @Prop({ type: String })
  original_filename: string;
}

const ImageSchema = SchemaFactory.createForClass(Image);

export { ImageSchema };