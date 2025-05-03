import { modelNames } from "@/common/constants/model-name.constant";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true, collection: modelNames.WALLET_MODEL_NAME })
export class Wallet extends Document<Types.ObjectId> {
  @Prop({
    type: Types.ObjectId,
    ref: modelNames.USER_MODEL_NAME,
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