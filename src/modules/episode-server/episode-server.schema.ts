import { modelNames } from '@/common/constants/model-name.constant';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: modelNames.EPISODE_SERVER_MODEL_NAME })
export class EpisodeServer extends Document {
  @Prop({
    type: Types.ObjectId,
    refPath: modelNames.EPISODE_MODEL_NAME,
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