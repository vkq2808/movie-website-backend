import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Wallet, WALLET_MODEL_NAME } from "./wallet.schema";

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(WALLET_MODEL_NAME)
    private readonly walletModel: Model<Wallet>
  ) { }
}