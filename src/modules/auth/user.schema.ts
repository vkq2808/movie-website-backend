import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { enums } from '@/common';
import { modelNames } from '@/common/constants/model-name.constant';


@Schema({ timestamps: true, collection: modelNames.USER_MODEL_NAME, autoIndex: true })
export class User extends Document<Types.ObjectId> {

  @Prop({
    type: [{ type: Types.ObjectId, ref: modelNames.MOVIE_MODEL_NAME }],
    default: [],
  })
  favoriteMovies: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: modelNames.PAYMENT_MODEL_NAME }],
    default: [],
  })
  payments: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: modelNames.CHAT_MODEL_NAME }],
    default: [],
  })
  chats: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: modelNames.FEEDBACK_MODEL_NAME }],
    default: [],
  })
  feedbacks: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: modelNames.SEARCH_HISTORY_MODEL_NAME }],
    default: [],
  })
  searchHistories: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    ref: modelNames.WALLET_MODEL_NAME,
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

  @Prop({ required: [true, 'Please enter your password'] })
  password: string;

  @Prop({ required: [true, 'Please enter your name'] })
  username: string;

  @Prop({ required: [false] })
  birthdate: Date;

  @Prop({ required: [false] })
  photoUrl: string;

  @Prop({
    type: String,
    enum: enums.Role,
    default: enums.Role.Customer,
  })
  role: enums.Role;

  @Prop({
    type: Boolean,
    default: false,
  })
  isVerified: boolean;
}

const UserSchema = SchemaFactory.createForClass(User);


export { UserSchema };