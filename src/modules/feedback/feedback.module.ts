import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { FeedbackSchema } from "@/modules/feedback/feedback.schema";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { modelNames } from "@/common/constants/model-name.constant";


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: modelNames.FEEDBACK_MODEL_NAME, schema: FeedbackSchema }
    ])
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService]
})
export class FeedbackModule { }