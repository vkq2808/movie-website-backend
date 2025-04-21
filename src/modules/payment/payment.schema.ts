import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { enums } from "@/common";
import { modelNames } from "@/common/constants/model-name.constant";

@Schema({ timestamps: true, collection: modelNames.PAYMENT_MODEL_NAME })
export class Payment extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: modelNames.USER_MODEL_NAME,
    required: [true, 'UserId is required']
  })
  user: Types.ObjectId;

  @Prop({
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  })
  amount: number;

  @Prop({
    type: String,
    required: [true, 'Payment method is required'],
    enum: enums.PaymentMethod
  })
  paymentMethod: string;

  @Prop({
    type: String,
    enum: enums.PaymentStatus,
    default: enums.PaymentStatus.Pending
  })
  paymentStatus: enums.PaymentStatus;
}

const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.pre('find', function () {
  this.populate('user');
});

PaymentSchema.pre('findOne', function () {
  this.populate('user');
});

export { PaymentSchema };