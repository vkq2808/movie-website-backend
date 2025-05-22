import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { Payment } from "./payment.entity";
import { User } from "../auth/user.entity";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Payment, User])
  ],
  controllers: [PaymentController],
  providers: [PaymentService]
})
export class PaymentModule { }