import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Feedback } from "./feedback.entity";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";


@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Feedback])
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService]
})
export class FeedbackModule { }