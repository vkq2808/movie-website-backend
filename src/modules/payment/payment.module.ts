import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { PAYMENT_MODEL_NAME, PaymentSchema } from "./payment.schema";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: PAYMENT_MODEL_NAME, schema: PaymentSchema }
    ])
  ],
  controllers: [PaymentController],
  providers: [PaymentService]
})
export class PaymentModule { }