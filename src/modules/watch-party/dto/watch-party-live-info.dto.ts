import { WatchParty } from '../entities/watch-party.entity';
import { WatchPartyLog } from '../entities/watch-party-log.entity';
import { ChatMessage } from '../watch-party-room';

export class WatchPartyLiveInfoDto {
  startTime: Date;
  currentTime: number;
  messages: ChatMessage[];
  watchParty: WatchParty;
  participants: { id: string; username: string }[];
  total_likes: {
    [userId: string]: number;
    total: number;
  };
  streamUrl: string;
}
