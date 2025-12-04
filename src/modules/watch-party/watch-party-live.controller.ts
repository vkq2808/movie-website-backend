import { Controller, Get, Param } from '@nestjs/common';
import { WatchPartyLiveService } from './watch-party-live.service';
import { ResponseUtil } from '@/common';

@Controller('watch-parties')
export class WatchPartyLiveController {
  constructor(private readonly watchPartyLiveService: WatchPartyLiveService) { }

  @Get(':id/live')
  async getLiveInfo(@Param('id') id: string) {
    const info = await this.watchPartyLiveService.getInfo(id);
    return ResponseUtil.success(info);
  }
}
