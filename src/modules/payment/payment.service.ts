import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Payment, PAYMENT_MODEL_NAME } from "./payment.schema";

@Injectable()
export class PaymentService {
  constructor(@InjectModel(PAYMENT_MODEL_NAME) private paymentModel: Model<Payment>) { }
}