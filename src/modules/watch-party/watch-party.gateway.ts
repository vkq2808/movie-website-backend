import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyEventType } from './entities/watch-party-log.entity';

interface JoinPartyPayload {
  partyId: string;
  userId: string;
  username: string;
}

interface ChatMessagePayload {
  partyId: string;
  userId: string;
  username: string;
  message: string;
  eventTime: number;
}

interface PlayerActionPayload {
  partyId: string;
  userId: string;
  action: 'play' | 'pause' | 'seek';
  currentTime: number;
  eventTime: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/watch-party',
})
export class WatchPartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeUsers: Map<string, Set<string>> = new Map(); // partyId -> Set of userIds

  constructor(private watchPartyService: WatchPartyService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Remove user from all parties
    this.activeUsers.forEach((users, partyId) => {
      const userId = Array.from(users).find((id) => client.id.includes(id));
      if (userId) {
        users.delete(userId);
        this.server.to(partyId).emit('user_left', {
          userId,
          participantCount: users.size,
        });
      }
    });
  }

  @SubscribeMessage('join_party')
  async handleJoinParty(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPartyPayload,
  ) {
    const { partyId, userId, username } = payload;

    // Check if user can join
    const canJoin = await this.watchPartyService.canJoinParty(partyId, userId);
    if (!canJoin) {
      client.emit('error', { message: 'Not authorized to join this party' });
      return;
    }

    // Join room
    client.join(partyId);

    // Track active user
    if (!this.activeUsers.has(partyId)) {
      this.activeUsers.set(partyId, new Set());
    }
    const partyUsers = this.activeUsers.get(partyId);
    if (partyUsers) {
      partyUsers.add(userId);
    }

    // Log event
    const eventTime = this.calculateEventTime(partyId);
    await this.watchPartyService.logEvent(
      partyId,
      userId,
      WatchPartyEventType.JOIN,
      { username },
      eventTime,
    );

    // Broadcast to room
    const currentPartyUsers = this.activeUsers.get(partyId);
    this.server.to(partyId).emit('user_joined', {
      userId,
      username,
      participantCount: currentPartyUsers?.size || 0,
      timestamp: new Date().toISOString(),
    });

    // Send current participants list to the joining user
    const partyParticipants = this.activeUsers.get(partyId);
    if (partyParticipants) {
      const participants = Array.from(partyParticipants);
      client.emit('participant_list', { participants });
    }
  }

  @SubscribeMessage('leave_party')
  async handleLeaveParty(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { partyId: string; userId: string; username: string },
  ) {
    const { partyId, userId, username } = payload;

    client.leave(partyId);

    // Remove from active users
    const activePartyUsers = this.activeUsers.get(partyId);
    if (activePartyUsers) {
      activePartyUsers.delete(userId);
    }

    // Log event
    const eventTime = this.calculateEventTime(partyId);
    await this.watchPartyService.logEvent(
      partyId,
      userId,
      WatchPartyEventType.LEAVE,
      { username },
      eventTime,
    );

    // Broadcast to room
    this.server.to(partyId).emit('user_left', {
      userId,
      username,
      participantCount: this.activeUsers.get(partyId)?.size || 0,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatMessagePayload,
  ) {
    const { partyId, userId, username, message, eventTime } = payload;

    // Log message
    await this.watchPartyService.logEvent(
      partyId,
      userId,
      WatchPartyEventType.MESSAGE,
      { username, message },
      eventTime,
    );

    // Broadcast to room
    this.server.to(partyId).emit('new_message', {
      userId,
      username,
      message,
      realTime: new Date().toISOString(),
      eventTime,
    });
  }

  @SubscribeMessage('player_action')
  async handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlayerActionPayload,
  ) {
    const { partyId, userId, action, currentTime, eventTime } = payload;

    // Log action
    const eventTypeMap = {
      play: WatchPartyEventType.PLAY,
      pause: WatchPartyEventType.PAUSE,
      seek: WatchPartyEventType.SEEK,
    };

    await this.watchPartyService.logEvent(
      partyId,
      userId,
      eventTypeMap[action],
      { currentTime },
      eventTime,
    );

    // Broadcast to room (except sender)
    client.to(partyId).emit('sync_player', {
      action,
      currentTime,
      timestamp: new Date().toISOString(),
    });
  }

  private calculateEventTime(partyId: string): number {
    // This should calculate seconds from party start time
    // For now, returning 0 - should be implemented with actual party start time
    return 0;
  }
}