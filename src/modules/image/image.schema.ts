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
export class Image extends Document<Types.ObjectId> {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  alt: string;

  @Prop({ type: Number })
  width: number;

  @Prop({ type: Number })
  height: number;

  @Prop({ type: Number })
  bytes: number;
}

const ImageSchema = SchemaFactory.createForClass(Image);

export { ImageSchema };