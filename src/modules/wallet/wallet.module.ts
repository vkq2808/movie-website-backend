import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WALLET_MODEL_NAME, WalletSchema } from "@/modules/wallet/wallet.schema";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WALLET_MODEL_NAME, schema: WalletSchema }
    ])
  ],
  controllers: [WalletController],
  providers: [WalletService]
})
export class WalletModule { }