import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Feedback } from "./feedback.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(modelNames.FEEDBACK_MODEL_NAME)
    private feedbackModel: Model<Feedback>
  ) { }
}