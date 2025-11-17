
import { Controller, Get, Param } from '@nestjs/common';
import { WatchPartyLiveService } from './watch-party-live.service';

@Controller('watch-parties')
export class WatchPartyLiveController {
  constructor(
    private readonly watchPartyLiveService: WatchPartyLiveService,
  ) {}

  @Get(':id/live')
  getLiveInfo(@Param('id') id: string) {
    return this.watchPartyLiveService.getInfo(id);
  }
}
