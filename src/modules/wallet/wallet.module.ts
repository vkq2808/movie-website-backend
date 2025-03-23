import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WalletSchema } from "@/modules/wallet/wallet.schema";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";
import { modelNames } from "@/common/constants/model-name.constant";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: modelNames.WALLET_MODEL_NAME, schema: WalletSchema }
    ])
  ],
  controllers: [WalletController],
  providers: [WalletService]
})
export class WalletModule { }