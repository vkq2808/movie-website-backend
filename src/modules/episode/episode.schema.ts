import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { modelNames } from '@/common/constants/model-name.constant';

@Schema({ timestamps: true, collection: modelNames.EPISODE_MODEL_NAME })
export class Episode extends Document {
  @Prop({
    type: Types.ObjectId,
    required: [true, 'MovieId is required'],
    refPath: modelNames.MOVIE_MODEL_NAME
  })
  movie: Types.ObjectId;

  @Prop({
    type: [
      { type: Types.ObjectId, refPath: modelNames.EPISODE_SERVER_MODEL_NAME }
    ],
    required: [false],
    default: [],
  })
  servers: Types.ObjectId[];

  @Prop({
    type: String,
    required: [true, 'Please enter your title'],
  })
  title: string;

  @Prop({
    type: String,
    required: [true, 'Please enter your description'],
  })
  description: string;

  @Prop({
    type: Number,
    required: [true, 'Please enter your duration'],
  })
  duration: number;

  @Prop({
    type: Date,
    required: [true, 'Please enter your release date'],
    validate: {
      validator: (date: string) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        return regex.test(date);
      },
      message: 'Please enter a valid release date',
    },
  })
  releasedDate: Date;
}

const EpisodeSchema = SchemaFactory.createForClass(Episode);

EpisodeSchema.pre('find', function () {
  this.populate('servers');
});

EpisodeSchema.pre('findOne', function () {
  this.populate('servers');
});

export { EpisodeSchema };