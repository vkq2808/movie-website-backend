import { Controller, UseGuards } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { JwtAuthGuard } from "@/modules/auth/strategy";

@Controller("payment")
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService
  ) { }
}