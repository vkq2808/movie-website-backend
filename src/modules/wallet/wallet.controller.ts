import { Controller, UseGuards } from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { JwtAuthGuard } from "@/modules/auth/strategy";

@Controller("wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService
  ) { }
}
