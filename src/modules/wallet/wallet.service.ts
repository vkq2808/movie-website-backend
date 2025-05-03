import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Wallet } from "./wallet.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(modelNames.WALLET_MODEL_NAME)
    private readonly walletModel: Model<Wallet>
  ) { }
}