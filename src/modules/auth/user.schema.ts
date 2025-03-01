import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { enums } from '@/common';
import { MOVIE_MODEL_NAME } from '../movie';
import { PAYMENT_MODEL_NAME } from '../payment';
import { CHAT_MODEL_NAME } from '../chat';
import { FEEDBACK_MODEL_NAME } from '../feedback';
import { SEARCH_HISTORY_MODEL_NAME } from '../search-history';
import { WALLET_MODEL_NAME } from '../wallet';

export const USER_MODEL_NAME = 'User';

@Schema({ timestamps: true, collection: USER_MODEL_NAME })
export class User extends Document {

  @Prop({
    type: [{ type: Types.ObjectId, ref: MOVIE_MODEL_NAME }],
    default: [],
  })
  favoriteMovies: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: PAYMENT_MODEL_NAME }],
    default: [],
  })
  payments: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: CHAT_MODEL_NAME }],
    default: [],
  })
  chats: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: FEEDBACK_MODEL_NAME }],
    default: [],
  })
  feedbacks: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: SEARCH_HISTORY_MODEL_NAME }],
    default: [],
  })
  searchHistories: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    ref: WALLET_MODEL_NAME,
    default: null,
  })
  wallet: Types.ObjectId;

  @Prop({
    type: String,
    required: [true, 'Please enter your email'],
    unique: true,
    validate: {
      validator: (email: string) => {
        const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        return regex.test(email);
      },
      message: 'Please enter a valid email',
    },
  })
  email: string;

  @Prop({ required: [true, 'Please enter your password'], minlength: 6 })
  password: string;

  @Prop({ required: [true, 'Please enter your name'] })
  username: string;

  @Prop({ type: Number, required: [true, 'Please enter your age'], min: 0, max: 150 })
  age: number;

  @Prop({ required: [false] })
  photoUrl: string;

  @Prop({
    type: String,
    enum: enums.Role,
    default: enums.Role.Customer,
  })
  role: enums.Role;
}

const UserSchema = SchemaFactory.createForClass(User);


export { UserSchema };