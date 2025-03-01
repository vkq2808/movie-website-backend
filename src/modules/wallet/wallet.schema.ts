import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { USER_MODEL_NAME } from "@/modules/auth/user.schema";

export const WALLET_MODEL_NAME = 'Wallet';

@Schema({ timestamps: true, collection: WALLET_MODEL_NAME })
export class Wallet extends Document {
  @Prop({
    type: Types.ObjectId,
    refPath: USER_MODEL_NAME,
    required: [true, "User is required"],
  })
  user: Types.ObjectId;

  @Prop({
    type: Number,
    default: 0,
  })
  balance: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet)