import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationCase } from './entities/moderation-case.entity';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { ReportModule } from '@/modules/report/report.module';
import { FeedbackModule } from '@/modules/feedback/feedback.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModerationCase]),
    ReportModule,
    FeedbackModule,
  ],
  providers: [ModerationService],
  controllers: [ModerationController],
  exports: [ModerationService],
})
export class ModerationModule {}

