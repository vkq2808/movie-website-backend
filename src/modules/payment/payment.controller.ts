import { Controller, UseGuards } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { JwtAuthGuard } from "@/common";

@Controller("payment")
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService
  ) { }
}