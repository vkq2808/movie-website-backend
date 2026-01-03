import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { FeedbackModule } from '@/modules/feedback/feedback.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report]),
    FeedbackModule,
  ],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}

