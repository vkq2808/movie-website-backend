import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WatchPartyService } from './watch-party.service';

@Injectable()
export class WatchPartyScheduler {
  constructor(private readonly watchPartyService: WatchPartyService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async updateWatchPartyStatuses() {
    await this.watchPartyService.updatePartyStatus();
  }
}