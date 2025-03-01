import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MOVIE_MODEL_NAME } from '@/modules/movie/movie.schema';

export const ACTOR_MODEL_NAME = 'Actor';

@Schema({ timestamps: true, collection: ACTOR_MODEL_NAME })
export class Actor extends Document {
  @Prop({
    type: [{ type: Types.ObjectId, ref: MOVIE_MODEL_NAME }],
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
  })
  photoUrl: string;
}

const ActorSchema = SchemaFactory.createForClass(Actor);

ActorSchema.pre('find', function (next) {
  this.populate('movies');
  next();
});
ActorSchema.pre('findOne', function (next) {
  this.populate('movies');
  next();
});

export { ActorSchema };
