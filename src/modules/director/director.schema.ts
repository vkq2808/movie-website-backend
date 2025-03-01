import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MOVIE_MODEL_NAME } from '@/modules/movie/movie.schema';

export const DIRECTOR_MODEL_NAME = 'Director';

@Schema({ timestamps: true, collection: DIRECTOR_MODEL_NAME })
export class Director extends Document {

  @Prop({
    type: [
      { type: Types.ObjectId, ref: MOVIE_MODEL_NAME }
    ],
    required: [false],
    default: [],
  })
  movies: Types.ObjectId[];

  @Prop({
    type: String,
    required: [true, 'Please enter your name'],
  })
  name: string;

  @Prop({
    type: String,
    required: [true, 'Please enter your bio'],
  })
  biography: string;

  @Prop({
    type: Date,
    required: [true, 'Please enter your date of birth'],
    validate: [
      {
        validator: function (date: Date) {
          return date instanceof Date && !isNaN(date.getTime());
        },
        message: 'Invalid date format',
      },
      {
        validator: function (date: Date) {
          return date < new Date();
        },
        message: 'Birth date must be in the past',
      },
    ],
  })
  birthDate: Date;

  @Prop({
    type: String,
    required: [false],
  })
  photoUrl: string;
}

const DirectorSchema = SchemaFactory.createForClass(Director);

DirectorSchema.pre('find', function () {
  this.populate('movies');
});

DirectorSchema.pre('findOne', function () {
  this.populate('movies');
});

export { DirectorSchema };