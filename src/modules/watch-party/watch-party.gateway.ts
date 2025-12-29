import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenPayload } from 'src/common';
import { WatchPartyRoomManager } from './watch-party-room.manager';
import { WsAuthMiddleware } from '@/middlewares/ws-auth.middleware';
import { Logger } from '@nestjs/common';

const SEEK_RATE_LIMIT_MS = 2000; // 1 seek per 2s
const PROGRESS_UPDATE_RATE_LIMIT_MS = 4000; // Rate limit progress updates

/** Enhanced Socket with auth data */
type AuthenticatedSocket = Socket & { data: { user: TokenPayload } };

/**
 * Watch Party WebSocket Gateway
 *
 * Namespace: /watch-party
 *
 * Responsibilities:
 * - Accept client connections and join rooms
 * - Route host commands (play, pause, seek, start) to all participants
 * - Forward progress updates from host for anti-desync
 * - Broadcast user join/leave events
 * - Handle client disconnect cleanup
 *
 * Event contract matches FE types in fe/src/types/watch-party.ts
 * Units: startTime (ms), progress/position (seconds)
 */
@WebSocketGateway({
  namespace: 'watch-party',
  cors: { origin: '*' },
})
export class WatchPartyGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WatchPartyGateway.name);
  private seekTimestamps = new Map<string, number>();
  private progressUpdateTimestamps = new Map<string, number>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roomManager: WatchPartyRoomManager,
    private readonly wsAuthMiddleware: WsAuthMiddleware,
  ) {}

  afterInit() {
    this.server.use(this.wsAuthMiddleware.use);
    this.roomManager.setServer(this.server);
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(
      `Client connected: ${client.id} - User: ${client.data.user.sub}`,
    );
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const disconnectInfo = this.roomManager.removeUserFromRoom(
      client.data.user,
    );

    if (disconnectInfo) {
      const { room, isHost, userCount } = disconnectInfo;

      // Notify remaining users
      this.server
        .to(room.meta.roomId)
        .emit('watch_party:user_left', { userId: client.data.user.sub });
    }
  }

  /**
   * Client joins a watch party room
   *
   * Emitted by: Client on connection
   * Payload: { roomId: string }
   * Response: Sends watch_party:join_response with room state
   */
  @SubscribeMessage('watch_party:join')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { roomId } = data;
    const { sub: userId, username } = client.data.user;
    this.logger.log(`[Data]:, ${JSON.stringify(data, null, 2)}`);

    this.logger.log(`User ${userId} attempting to join room ${roomId}`);

    // Get existing room
    const room = this.roomManager.getRoom(roomId);

    if (!room) {
      this.logger.error(`Room ${roomId} not found`);
      client.emit('watch_party:error', {
        code: 'ROOM_NOT_FOUND',
        message: `Watch party room ${roomId} does not exist`,
      });
      return;
    }

    // Add participant
    room.addParticipant(client.data.user);
    client.join(roomId);

    // Get current room state
    const state = room.getCurrentState();

    // Send join response to client
    client.emit('watch_party:join_response', {
      roomId,
      isPlaying: state.isPlaying,
      startTime: state.isPlaying ? room.meta.startTime.getTime() : null,
      progress: state.currentTime,
      streamUrl: state.streamUrl,
      participants: state.participants.map((p) => ({
        id: p.id,
        username: p.username,
      })),
      messages: state.messages,
      totalLikes: state.totalLikes,
      hostId: room.meta.hostId,
    });

    // Broadcast to others
    client.to(roomId).emit('watch_party:user_joined', {
      id: userId,
      username,
    });

    this.logger.log(
      `User ${userId} joined room ${roomId}. Total: ${state.participants.length}`,
    );
  }

  /**
   * Client leaves room
   *
   * Emitted by: Client
   */
  @SubscribeMessage('watch_party:leave')
  handleLeaveRoom(@ConnectedSocket() client: AuthenticatedSocket) {
    // Socket disconnect will handle cleanup
    client.disconnect();
  }

  /**
   * Host plays stream (starts or resumes from pause)
   *
   * Emitted by: Host only
   * Payload: { roomId: string, position?: number }
   * Broadcasts: watch_party:play_broadcast with startTime
   */
  @SubscribeMessage('watch_party:play')
  handlePlay(
    @MessageBody() data: { roomId: string; position?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = this.roomManager.getRoom(data.roomId);
    if (!room || room.meta.hostId !== client.data.user.sub) {
      this.logger.warn(`Unauthorized play attempt by ${client.data.user.sub}`);
      client.emit('watch_party:error', {
        code: 'UNAUTHORIZED',
        message: 'Only host can control playback',
      });
      return;
    }

    // Set start time: current server time (milliseconds)
    const startTime = Date.now();

    // Broadcast play event to all in room (including host)
    this.server.to(data.roomId).emit('watch_party:play_broadcast', {
      startTime,
    });

    this.logger.log(
      `Host ${client.data.user.sub} started playback in room ${data.roomId}`,
    );
  }

  /**
   * Host pauses stream
   *
   * Emitted by: Host only
   * Payload: { roomId: string, position: number }
   * Broadcasts: watch_party:pause_broadcast
   */
  @SubscribeMessage('watch_party:pause')
  handlePause(
    @MessageBody() data: { roomId: string; position: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = this.roomManager.getRoom(data.roomId);
    if (!room || room.meta.hostId !== client.data.user.sub) {
      this.logger.warn(`Unauthorized pause attempt by ${client.data.user.sub}`);
      client.emit('watch_party:error', {
        code: 'UNAUTHORIZED',
        message: 'Only host can control playback',
      });
      return;
    }

    this.server.to(data.roomId).emit('watch_party:pause_broadcast', {
      position: data.position, // seconds
    });

    this.logger.log(
      `Host ${client.data.user.sub} paused at ${data.position}s in room ${data.roomId}`,
    );
  }

  /**
   * Host seeks to new position
   *
   * Emitted by: Host only
   * Payload: { roomId: string, position: number }
   * Broadcasts: watch_party:seek_broadcast
   */
  @SubscribeMessage('watch_party:seek')
  handleSeek(
    @MessageBody() data: { roomId: string; position: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = this.roomManager.getRoom(data.roomId);
    if (!room || room.meta.hostId !== client.data.user.sub) {
      this.logger.warn(`Unauthorized seek attempt by ${client.data.user.sub}`);
      client.emit('watch_party:error', {
        code: 'UNAUTHORIZED',
        message: 'Only host can seek',
      });
      return;
    }

    // Rate limit seeks
    const now = Date.now();
    const lastSeek = this.seekTimestamps.get(client.id) || 0;
    if (now - lastSeek < SEEK_RATE_LIMIT_MS) {
      client.emit('watch_party:error', {
        code: 'RATE_LIMITED',
        message: 'Seek requests are too frequent',
      });
      return;
    }
    this.seekTimestamps.set(client.id, now);

    this.server.to(data.roomId).emit('watch_party:seek_broadcast', {
      position: data.position, // seconds
    });

    this.logger.log(
      `Host ${client.data.user.sub} seeked to ${data.position}s in room ${data.roomId}`,
    );
  }

  /**
   * Host starts playback with initial sync
   *
   * Emitted by: Host only
   * Payload: { roomId: string, startTime: number }
   * Broadcasts: watch_party:play_broadcast
   */
  @SubscribeMessage('watch_party:start')
  handleStart(
    @MessageBody() data: { roomId: string; startTime: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = this.roomManager.getRoom(data.roomId);
    if (!room || room.meta.hostId !== client.data.user.sub) {
      this.logger.warn(`Unauthorized start attempt by ${client.data.user.sub}`);
      client.emit('watch_party:error', {
        code: 'UNAUTHORIZED',
        message: 'Only host can start playback',
      });
      return;
    }

    // Validate startTime is recent
    const timeDiff = Math.abs(Date.now() - data.startTime);
    if (timeDiff > 5000) {
      // More than 5s in past/future
      client.emit('watch_party:error', {
        code: 'INVALID_TIMESTAMP',
        message: 'Start time must be near current server time',
      });
      return;
    }

    this.server.to(data.roomId).emit('watch_party:play_broadcast', {
      startTime: data.startTime,
    });

    this.logger.log(
      `Host ${client.data.user.sub} started live in room ${data.roomId} at ${new Date(data.startTime).toISOString()}`,
    );
  }

  /**
   * Host sends periodic progress updates for anti-desync
   *
   * Emitted by: Host every ~5 seconds
   * Payload: { roomId: string, progress: number, timestamp?: number }
   * Broadcasts: watch_party:progress_broadcast to clients
   */
  @SubscribeMessage('watch_party:progress_update')
  handleProgressUpdate(
    @MessageBody()
    data: { roomId: string; progress: number; timestamp?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = this.roomManager.getRoom(data.roomId);
    if (!room || room.meta.hostId !== client.data.user.sub) {
      // Non-host or invalid room
      return;
    }

    // Rate limit progress updates to avoid flooding
    const now = Date.now();
    const lastUpdate = this.progressUpdateTimestamps.get(client.id) || 0;
    if (now - lastUpdate < PROGRESS_UPDATE_RATE_LIMIT_MS) {
      return;
    }
    this.progressUpdateTimestamps.set(client.id, now);

    // Broadcast to all clients (excluding sender, or including for confirmation)
    this.server.to(data.roomId).emit('watch_party:progress_broadcast', {
      progress: data.progress, // seconds
      timestamp: data.timestamp || Date.now(),
    });
  }
}
