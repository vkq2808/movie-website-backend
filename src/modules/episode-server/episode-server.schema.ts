import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EPISODE_MODEL_NAME } from '@/modules/episode/episode.schema';

export const EPISODE_SERVER_MODEL_NAME = 'EpisodeServer';

@Schema({ timestamps: true, collection: EPISODE_SERVER_MODEL_NAME })
export class EpisodeServer extends Document {
  @Prop({
    type: Types.ObjectId,
    refPath: EPISODE_MODEL_NAME,
    required: [true, 'EpisodeId is required'],
  })
  episode: Types.ObjectId;

  @Prop({
    type: String,
    required: [true, 'Please enter your url'],
  })
  url: string;
}

const EpisodeServerSchema = SchemaFactory.createForClass(EpisodeServer);

export { EpisodeServerSchema };