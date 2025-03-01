import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Feedback, FEEDBACK_MODEL_NAME } from "./feedback.schema";

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(FEEDBACK_MODEL_NAME)
    private feedbackModel: Model<Feedback>
  ) { }
}