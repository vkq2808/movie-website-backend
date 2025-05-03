import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { PaymentSchema } from "./payment.schema";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { modelNames } from "@/common/constants/model-name.constant";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: modelNames.PAYMENT_MODEL_NAME, schema: PaymentSchema }
    ])
  ],
  controllers: [PaymentController],
  providers: [PaymentService]
})
export class PaymentModule { }