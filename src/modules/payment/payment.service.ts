import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Payment } from "./payment.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class PaymentService {
  constructor(@InjectModel(modelNames.PAYMENT_MODEL_NAME) private paymentModel: Model<Payment>) { }
}