import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  // // Tác vụ chạy mỗi 5 giây
  // @Cron(CronExpression.EVERY_5_SECONDS)
  // handleCron() {
  //   this.logger.debug('Tác vụ background chạy mỗi 5 giây');
  // }
}
