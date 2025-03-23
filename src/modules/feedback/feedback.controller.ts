import { Controller, UseGuards } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { enums } from "@/common";
import { JwtAuthGuard } from "@/modules/auth/strategy";
@Controller("feedback")
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService
  ) { }
}
