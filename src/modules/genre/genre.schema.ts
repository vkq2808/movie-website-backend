import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MOVIE_MODEL_NAME } from '@/modules/movie/movie.schema';

export const GENRE_MODEL_NAME = 'Genre';

@Schema({ timestamps: true, collection: GENRE_MODEL_NAME })
export class Genre extends Document {
  @Prop({
    type: String,
    required: [true, 'Please enter the name of the genre'],
  })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, refPath: MOVIE_MODEL_NAME }] })
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