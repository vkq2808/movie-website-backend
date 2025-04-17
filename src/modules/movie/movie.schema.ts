import { modelNames } from '@/common/constants/model-name.constant';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: modelNames.MOVIE_MODEL_NAME, autoIndex: true })
export class Movie extends Document {

  @Prop({ type: [{ type: Types.ObjectId, refPath: modelNames.GENRE_MODEL_NAME }] })
  genres: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, refPath: modelNames.USER_MODEL_NAME }],
    default: [],
  })
  favoritedBy: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    refPath: modelNames.DIRECTOR_MODEL_NAME,
  })
  director: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, refPath: modelNames.ACTOR_MODEL_NAME }],
  })
  cast: Types.ObjectId[];

  @Prop({
    type: String,
    required: [true, 'Please enter the title of the movie'],
  })
  title: string;

  @Prop({ type: String })
  originalTitle: string;

  @Prop({ type: String, required: [true, 'Please enter language of the movie'] })
  language: string;

  @Prop({ type: String })
  originalLanguage: string;

  @Prop({
    type: String,
  })
  description: string;

  @Prop({
    type: String,
  })
  releaseDate: string;

  @Prop({
    type: String
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

  @Prop({ type: String })
  backdropPath: string;
  @Prop({ type: String })
  voteAverage: string;
  @Prop({ type: Number })
  voteCount: number;
  @Prop({ type: Number })
  popularity: number;
  @Prop({ type: Boolean })
  adult: boolean;
  @Prop({ type: Boolean })
  video: boolean;

  @Prop({ type: Number })
  originalId: number;
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