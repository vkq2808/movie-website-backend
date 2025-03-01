import { Controller, UseGuards } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { enums, JwtAuthGuard } from "@/common";

@Controller("feedback")
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService
  ) { }
}
