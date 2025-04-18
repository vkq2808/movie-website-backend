import { modelNames } from '@/common/constants/model-name.constant';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: modelNames.GENRE_MODEL_NAME })
export class Genre extends Document {
  @Prop({
    type: String,
    required: [true, 'Please enter the name of the genre'],
  })
  name: string;

  @Prop({
    type: String,
    required: [true, 'Please enter the slug of the genre'],
  })
  slug: string;

  @Prop({ type: [{ type: Types.ObjectId, refPath: modelNames.MOVIE_MODEL_NAME }] })
  movies: Types.ObjectId[];
}

const GenreSchema = SchemaFactory.createForClass(Genre);

GenreSchema.pre('find', function () {
  this.populate('movies');
});

GenreSchema.pre('findOne', function () {
  this.populate('movies');
});

export { GenreSchema };