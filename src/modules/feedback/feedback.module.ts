import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { FEEDBACK_MODEL_NAME, FeedbackSchema } from "@/modules/feedback/feedback.schema";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: FEEDBACK_MODEL_NAME, schema: FeedbackSchema }
    ])
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService]
})
export class FeedbackModule { }