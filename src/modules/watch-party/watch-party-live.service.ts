import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchParty } from './entities/watch-party.entity';
import { WatchPartyLog } from './entities/watch-party-log.entity';
import { WatchPartyRoomManager } from './watch-party-room.manager';
import { ResourcesNotFoundException } from '@/exceptions';

@Injectable()
export class WatchPartyLiveService {
  constructor(
    @InjectRepository(WatchParty)
    private readonly watchPartyRepository: Repository<WatchParty>,
    @InjectRepository(WatchPartyLog)
    private readonly watchPartyLogRepository: Repository<WatchPartyLog>,
    private readonly roomManager: WatchPartyRoomManager,
  ) {}

  async getInfo(partyId: string) {
    const watchParty = await this.watchPartyRepository.findOne({
      where: { id: partyId },
    });

    if (!watchParty) {
      throw new ResourcesNotFoundException('Watch party not found');
    }

    const now = new Date();
    const startTime = watchParty.start_time;
    const currentTime = now.getTime() - startTime.getTime();

    const room = this.roomManager.getRoom(partyId);

    if (!room) {
      throw new ResourcesNotFoundException('Watch party instance not found');
    }

    return room;
  }
}
