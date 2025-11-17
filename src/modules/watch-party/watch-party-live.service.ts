
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchParty } from './entities/watch-party.entity';
import { WatchPartyLog, WatchPartyEventType } from './entities/watch-party-log.entity';
import { WatchPartyLiveInfoDto } from './dto/watch-party-live-info.dto';

@Injectable()
export class WatchPartyLiveService {
  constructor(
    @InjectRepository(WatchParty)
    private readonly watchPartyRepository: Repository<WatchParty>,
    @InjectRepository(WatchPartyLog)
    private readonly watchPartyLogRepository: Repository<WatchPartyLog>,
  ) {}

  async getInfo(partyId: string): Promise<WatchPartyLiveInfoDto> {
    const watchParty = await this.watchPartyRepository.findOne({
      where: { id: partyId },
    });

    if (!watchParty) {
      throw new NotFoundException('Watch party not found');
    }

    const now = new Date();
    const startTime = watchParty.start_time;
    const currentTime = now.getTime() - startTime.getTime();

    const chats = await this.watchPartyLogRepository.find({
      where: {
        watch_party: { id: partyId },
        event_type: WatchPartyEventType.MESSAGE,
      },
      order: { created_at: 'DESC' },
      take: 50,
    });

    return {
      startTime,
      currentTime,
      chats,
    };
  }
}
