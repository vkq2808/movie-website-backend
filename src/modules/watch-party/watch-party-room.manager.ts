import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Server } from 'socket.io';
import { WatchParty, WatchPartyStatus } from './entities/watch-party.entity';
import { FullPartyState, WatchPartyRoom, WatchPartyMeta } from './watch-party-room';
import { WatchPartyPersistenceService } from './watch-party-persistence.service';
import { UserService } from '../user/user.service';
import { WatchPartyEventType } from './entities/watch-party-log.entity';
import { VideoType } from '@/common/enums';
import { TokenPayload } from '@/common';

@Injectable()
export class WatchPartyRoomManager
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatchPartyRoomManager.name);
  private rooms = new Map<string, WatchPartyRoom>();
  private server: Server | null = null;

  constructor(
    private readonly persistenceService: WatchPartyPersistenceService,
    @InjectRepository(WatchParty)
    private readonly watchPartyRepository: Repository<WatchParty>,
    private readonly userService: UserService
  ) { }

  // --- Lifecycle Hooks ---

  async onModuleInit(): Promise<void> {
    this.logger.log('WatchPartyRoomManager initializing...');
    await this.loadActivePartiesFromDB();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdownFlushAll();
  }

  public removeUserFromRoom(user: TokenPayload) {
    for (const room of this.rooms.values()) {
      const info = room.removeParticipant(user);
      if (info) return info;
    }
  }

  // --- Server Setup ---

  public setServer(server: Server) {
    this.logger.log('Socket.IO Server room has been set.');
    this.server = server;
  }

  // --- Instance Management ---

  public createRoom(
    meta: WatchPartyMeta,
    state: FullPartyState = {
      participants: [],
      messages: [],
      totalLikes: {
        total: 0,
      },
      currentTime: 0,
      isLive: false,
      isPlaying: false,
      lastUpdated: Date.now(),
    }
  ): WatchPartyRoom | undefined {
    if (!this.server) {
      this.logger.error(
        'Socket.IO Server is not set. Cannot create rooms.',
      );
      return undefined;
    }
    if (this.rooms.has(meta.roomId)) {
      return this.getRoom(meta.roomId);
    }

    this.logger.log(
      `Creating new watch party room for party ${meta.roomId}`,
    );
    const room = new WatchPartyRoom(
      meta,
      this.persistenceService,
      this.userService,
      this.server,
      state
    );
    this.rooms.set(meta.roomId, room);
    const countDownToStartTime = meta.startTime.getTime() - Date.now();
    const countDownToEndTime = meta.scheduledEndTime.getTime() - Date.now();
    this.logger.debug(`countDownToStartTime: ${countDownToStartTime}, countDownToEndTime: ${countDownToEndTime}`)
    if (countDownToStartTime > 0) {
      setTimeout(() => {
        this.logger.debug('Starting the room, ', room.meta.roomId)
        room.updatePlayerState({ isPlaying: true });
      }, countDownToStartTime);
    } else if (countDownToEndTime > 0) {
      this.logger.debug('Starting the room, ', room.meta.roomId)
      room.updatePlayerState({ isPlaying: true });
    }
    return room;
  }

  public getRoom(roomId: string): WatchPartyRoom | undefined {
    return this.rooms.get(roomId);
  }

  public getAllInstances(): WatchPartyRoom[] {
    return Array.from(this.rooms.values());
  }

  public async closeInstance(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.logger.log(
      `Closing room for party ${roomId}. Performing final flush...`,
    );
    await room.flush();
    room.cleanup();
    this.rooms.delete(roomId);
    this.logger.log(
      `Instance for party ${roomId} has been closed and removed.`,
    );
  }

  // --- Auto-loading and Scheduled Tasks ---

  private async loadActivePartiesFromDB() {
    this.logger.log(
      'Attempting to load active and upcoming watch parties from DB...',
    );
    try {
      const activeParties = await this.watchPartyRepository.find({
        where: {
          status: In([WatchPartyStatus.UPCOMING, WatchPartyStatus.ONGOING]),
        },
        relations: ['movie', 'movie.videos', 'host', 'logs'],
      });

      for (const [i, p] of activeParties.entries()) {
        if (p.end_time.getTime() < new Date().getTime()) {
          this.logger.log(`Skipped 1 active party, index: ${i}`);
          activeParties.splice(i, 1);
        }
      }

      if (activeParties.length === 0) {
        this.logger.log('No active or upcoming parties to load.');
        return;
      }

      this.logger.log(`Wating for server to init.`);
      // Wait until server is set. A better approach might be a ready flag or event emitter.
      await this.waitForServer();

      for (const party of activeParties) {
        this.logger.log(
          `Reloading room for party: ${party.id} (${party.status})`,
        );

        const validVideo = party.movie.videos?.find(v => v.type === VideoType.MOVIE) ?? party.movie.videos[0];

        const room = this.createRoom({
          roomId: party.id,
          movieId: party.movie.id,
          hostId: party.host?.id,
          startTime: party.start_time,
          scheduledEndTime: party.end_time,
          streamUrl: validVideo?.url ?? ''
        },
          {
            currentTime: 0,
            isLive: true,
            isPlaying: true,
            lastUpdated: Date.now(),
            participants: [],
            messages: party.logs
              ?.filter(log => log.event_type === WatchPartyEventType.MESSAGE && log.user)
              .map(log => ({
                id: log.id,
                content: log.content,
                real_time: log.real_time,
                user: {
                  id: log.user!.id,
                  username: log.user!.username
                },
                event_time: log.event_time
              })) ?? [],
            totalLikes: party.total_likes,
            party
          });
        this.logger.log(
          `Reloaded room for party: ${party.id} (${party.status})`,
        );
      }
      this.logger.log(
        `Successfully loaded ${activeParties.length} party rooms.`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to load active parties from database.',
        error.stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  public async periodicFlushAll(): Promise<void> {
    this.logger.log('Starting periodic flush for all dirty rooms...');
    const flushPromises = Array.from(this.rooms.values())
      .filter((room) => room.dirty)
      .map((room) => room.flush());

    if (flushPromises.length === 0) {
      this.logger.log('No dirty rooms to flush.');
      return;
    }

    await Promise.allSettled(flushPromises);
    this.logger.log(
      `Periodic flush completed for ${flushPromises.length} rooms.`,
    );
  }

  public async shutdownFlushAll(timeoutMs = 5000): Promise<void> {
    this.logger.log(
      'Server shutting down. Performing emergency flush for all rooms...',
    );
    const flushPromises = Array.from(this.rooms.values()).map((room) =>
      room.flush(),
    );
    if (flushPromises.length === 0) {
      this.logger.log('No rooms to flush on shutdown.');
      return;
    }

    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Shutdown flush timed out')),
        timeoutMs,
      ),
    );
    try {
      await Promise.race([Promise.allSettled(flushPromises), timeout]);
      this.logger.log('Shutdown flush completed.');
    } catch (error) {
      this.logger.error('Shutdown flush failed or timed out.', error.message);
    }
  }

  private waitForServer(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) return resolve();
      const start = Date.now();
      const interval = setInterval(() => {
        if (this.server) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(
            new Error('Timed out waiting for WebSocket server to be set.'),
          );
        }
      }, 100);
    });
  }
}
