import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import {
  WatchPartyEventType,
  WatchPartyLog,
} from './entities/watch-party-log.entity';
import { WatchPartyPersistenceService } from './watch-party-persistence.service';
import { User } from '../user/user.entity';
import { TokenPayload } from '@/common';
import e from 'express';
import { UserService } from '../user/user.service';
import { WatchParty } from './entities/watch-party.entity';

// --- Interfaces for State and Metadata ---

export interface WatchPartyMeta {
  roomId: string;
  movieId: string;
  hostId: string;
  startTime: Date;
  scheduledEndTime: Date;
  streamUrl: string;
}

export interface PlayerState {
  isLive: boolean;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
}

export interface ChatMessage {
  id: string;
  user: { id: string; username: string };
  content: { message: string };
  real_time: Date;
  event_time: number;
}

export interface FullPartyState extends PlayerState {
  participants: { id: string; username: string }[];
  messages: ChatMessage[];
  totalLikes: {
    [userId: string]: number;
    total: number;
  };
  party?: WatchParty;
}

type BufferedLog = {
  id: string,
  user?: TokenPayload,
  event_type: WatchPartyEventType,
  content: any,
  real_time: Date,
  event_time: number
};

const MAX_CHAT_HISTORY = 50;

export class WatchPartyRoom {
  private readonly logger: Logger;
  public readonly createdAt = Date.now();
  public lastFlushedAt = Date.now();
  public meta: WatchPartyMeta;
  public dirty = false;

  // --- Live State ---
  private playerState: PlayerState;
  private participants = new Map<string, { id: string; username: string }>();
  private chatHistory: ChatMessage[] = [];
  private likes = new Map<string, number>();
  private eventBuffer: BufferedLog[] = [];
  private party: WatchParty;
  private streamUrl: string;
  private actualPlaybackStart: number | null = null; // Track when host pressed play (ms epoch)

  private flushLock = false;

  constructor(
    meta: WatchPartyMeta,
    private readonly persistenceService: WatchPartyPersistenceService,
    private readonly userService: UserService,
    private readonly server: Server,
    initialState?: Partial<FullPartyState>,
  ) {
    this.meta = meta;
    this.logger = new Logger(`${WatchPartyRoom.name}:${this.meta.roomId}`);

    // Initialize state
    this.playerState = {
      isLive: initialState?.isLive ?? false,
      isPlaying: initialState?.isPlaying ?? false,
      currentTime: initialState?.currentTime ?? 0,
      lastUpdated: Date.now(),
    };

    if (initialState?.participants) {
      initialState.participants.forEach((p) => this.participants.set(p.id, p));
    }
    if (initialState?.messages) {
      this.chatHistory = initialState.messages;
    }

    if (initialState?.totalLikes) {
      this.likes = new Map(Object.entries(initialState.totalLikes));
    }

    if (initialState?.party) {
      this.party = initialState.party;
    }
  }

  // --- State Management & Real-time Logic ---

  public addParticipant(user: TokenPayload) {
    if (this.participants.has(user.sub)) return;

    this.logger.log(`User ${user.username} joined.`);
    this.participants.set(user.sub, { id: user.sub, username: user.username });
    this.bufferEvent(
      user,
      WatchPartyEventType.JOIN,
      null,
      this.playerState.currentTime,
    );

    this.server.to(this.meta.roomId).emit('watch_party:user_joined', {
      id: user.sub,
      username: user.username,
    });
  }

  public removeParticipant(user: TokenPayload): {
    room: WatchPartyRoom,
    isHost: boolean,
    userCount: number
  } | undefined {
    if (!this.participants.has(user.sub)) return;

    this.logger.log(`User ${user.username} left.`);
    this.participants.delete(user.sub);
    this.bufferEvent(
      user,
      WatchPartyEventType.LEAVE,
      null,
      this.playerState.currentTime,
    );
    this.server.to(this.meta.roomId).emit('watch_party:user_left', {
      userId: user.sub,
    });

    return {
      room: this,
      isHost: this.meta.hostId === user.sub,
      userCount: this.participants.size,
    }
  }

  public addChatMessage(user: TokenPayload, content: string) {
    const message: ChatMessage = {
      id: uuidv4(),
      user: { id: user.sub, username: user.username },
      content: { message: content },
      real_time: new Date(),
      event_time: this.playerState.currentTime,
    };

    this.chatHistory.push(message);
    if (this.chatHistory.length > MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }

    this.bufferEvent(
      user,
      WatchPartyEventType.MESSAGE,
      { message: content },
      this.playerState.currentTime,
    );
    this.server.to(this.meta.roomId).emit('watch_party:message', message);
  }

  public addLike(user: TokenPayload) {
    const newLikeCountByUser = (this.likes.get(user.sub) ?? 0) + 1;
    this.likes.set(user.sub, newLikeCountByUser);
    const newTotalLikeCount = this.likes.get('total') ?? 0;
    this.likes.set('total', newTotalLikeCount + 1);

    this.bufferEvent(
      user,
      WatchPartyEventType.LIKE,
      null,
      this.playerState.currentTime,
    );
    this.server.to(this.meta.roomId).emit('watch_party:like', {
      userId: user.sub,
    });
  }

  public updatePlayerState(newState: Partial<PlayerState>) {
    const updatedState = {
      ...this.playerState,
      ...newState,
      lastUpdated: Date.now(),
    };
    this.playerState = updatedState;

    // Track when playback actually starts for accurate progress calculation
    if (newState.isPlaying && !this.playerState.isPlaying) {
      // Transitioning from paused to playing
      this.actualPlaybackStart = Date.now();
    } else if (newState.isPlaying === false) {
      // Transitioning to paused - save current position and reset playback start
      this.actualPlaybackStart = null;
      this.playerState.currentTime = newState.currentTime ?? this.playerState.currentTime;
    }

    const eventType = newState.isPlaying
      ? WatchPartyEventType.PLAY
      : newState.isPlaying === false
        ? WatchPartyEventType.PAUSE
        : WatchPartyEventType.SEEK;
    this.bufferEvent(
      undefined,
      eventType,
      { currentTime: newState.currentTime },
      this.playerState.currentTime,
    );

    // Note: Player state updates are broadcast via watch_party:play_broadcast,
    // watch_party:pause_broadcast, watch_party:seek_broadcast, watch_party:progress_broadcast
    // from the gateway, not here. This method updates internal state only.
  }

  public getCurrentState(): FullPartyState & { streamUrl: string } {
    return {
      ...this.playerState,
      participants: Array.from(this.participants.values()) ?? [],
      messages: this.chatHistory ?? [],
      totalLikes: { ...Object.fromEntries(this.likes), total: this.likes.get('total') ?? 0 },
      party: this.party,
      streamUrl: this.meta.streamUrl,
      currentTime: this.calCurrentTime()
    };
  }

  // --- Data Persistence ---
  public calCurrentTime(): number {
    if (!this.playerState.isPlaying) {
      return this.playerState.currentTime; // Return stored position if paused
    }
    // If playing, return seconds elapsed since playback started
    const elapsedMs = Date.now() - (this.actualPlaybackStart || this.meta.startTime.getTime());
    return elapsedMs / 1000; // Convert to seconds ✓
  }

  private bufferEvent(
    user: TokenPayload | undefined,
    eventType: WatchPartyEventType,
    content: any,
    eventTime: number,
  ) {
    this.eventBuffer.push({
      id: uuidv4(),
      user: user,
      event_type: eventType,
      content,
      real_time: new Date(),
      event_time: eventTime,
    });
    this.dirty = true;
  }

  public async flush(): Promise<void> {
    if (this.flushLock || !this.dirty) {
      return;
    }

    this.flushLock = true;
    this.logger.log(`Starting flush for party ${this.meta.roomId}...`);

    const eventsToFlush = await Promise.all(
      this.eventBuffer.map(async (e) => {
        if (!e.user) {
          return e as Partial<WatchPartyLog>;
        }

        const user = await this.userService.findById(e.user.sub);
        return { ...e, user } as Partial<WatchPartyLog>;
      })
    );

    const eventsCount = eventsToFlush.length;

    try {

      await this.persistenceService.bulkInsertLogs(
        this.meta.roomId,
        eventsToFlush,
      );

      await this.persistenceService.updateWatchPartyCounters(
        this.meta.roomId,
        this.likes,
        this.participants.size,
      );

      this.eventBuffer.splice(0, eventsCount);
      this.lastFlushedAt = Date.now();
      this.dirty = this.eventBuffer.length > 0;

      this.logger.log(`Flush successful. Flushed ${eventsCount} items.`);
    } catch (error) {
      this.logger.error(`Flush failed. Buffer not cleared.`, error);
      // Buffer remains dirty for next retry cycle. 
    } finally {
      this.flushLock = false;
    }
  }

  public cleanup(): void {
    this.eventBuffer = [];
    this.chatHistory = [];
    this.participants.clear();
    this.likes.clear();
    this.dirty = false;
    this.logger.log(`Instance cleaned up.`);
  }
}
