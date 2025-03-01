import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GENRE_MODEL_NAME } from '../genre/genre.schema';
import { USER_MODEL_NAME } from '../auth/user.schema';
import { DIRECTOR_MODEL_NAME } from '../director/director.schema';
import { ACTOR_MODEL_NAME } from '../actor/actor.schema';

export const MOVIE_MODEL_NAME = 'Movie';

@Schema({ timestamps: true, collection: MOVIE_MODEL_NAME })
export class Movie extends Document {

  @Prop({ type: [{ type: Types.ObjectId, refPath: GENRE_MODEL_NAME }] })
  genres: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, refPath: USER_MODEL_NAME }],
    default: [],
  })
  favoritedBy: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    refPath: DIRECTOR_MODEL_NAME,
    required: [true, 'Please enter the director of the movie'],
  })
  director: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, refPath: ACTOR_MODEL_NAME }],
    required: [true, 'Please enter the cast of the movie'],
  })
  cast: Types.ObjectId[];

  @Prop({
    type: String,
    required: [true, 'Please enter the title of the movie'],
  })
  title: string;

  @Prop({
    type: String,
    required: [true, 'Please enter the description of the movie'],
  })
  description: string;

  @Prop({
    type: String,
    required: [true, 'Please enter the release date of the movie'],
    validate: {
      validator: (date: string) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        return regex.test(date);
      },
      message: 'Please enter a valid release date',
    },
  })
  releasedDate: string;

  @Prop({
    type: Number,
    required: [true, 'Please enter the duration of the movie'],
  })
  duration: number;

  @Prop({
    type: String,
    required: [false],
  })
  posterUrl: string;

  @Prop({
    type: String,
    required: [false],
  })
  trailerUrl: string;

  @Prop({
    type: Number,
    required: [false],
    validate: {
      validator: (rating: number) => {
        return rating >= 0 && rating <= 10;
      },
      message: 'Rating must be between 0 and 10',
    }
  })
  rating: number;
}

const MovieSchema = SchemaFactory.createForClass(Movie);

MovieSchema.pre('find', function () {
  this.populate({ path: 'genres' });
  // this.populate({ path: 'favoritedBy' });
  this.populate({ path: 'director' });
  this.populate({ path: 'cast' });
});

MovieSchema.pre('findOne', function () {
  this.populate({ path: 'genres' });
  this.populate({ path: 'favoritedBy' });
  this.populate({ path: 'director' });
  this.populate({ path: 'cast' });
});

export { MovieSchema };