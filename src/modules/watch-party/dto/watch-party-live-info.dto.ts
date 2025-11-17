
import { WatchPartyLog } from '../entities/watch-party-log.entity';

export class WatchPartyLiveInfoDto {
  startTime: Date;
  currentTime: number;
  chats: WatchPartyLog[];
}
