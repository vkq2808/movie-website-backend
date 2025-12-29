export interface PlayerState {
  currentTime: number;
  isPlaying: boolean;
  isLive: boolean;
  liveEdge: number;
}

export interface RoomState {
  id: string;
  host: string | null;
  viewers: Set<string>;
  lastKnownState: PlayerState | null;
}

// Events from Client to Server
export const CLIENT_EVENTS = {
  JOIN_ROOM: 'joinRoom',
  PLAYER_ACTION: 'playerAction',
};

// Events from Server to Client
export const SERVER_EVENTS = {
  SYNC_STATE: 'syncState',
  PLAYER_ACTION: 'playerAction',
  HOST_CHANGED: 'hostChanged',
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
};

// Player Actions
export type PlayerAction =
  | { type: 'PLAY'; payload: { currentTime: number } }
  | { type: 'PAUSE'; payload: { currentTime: number } }
  | { type: 'SEEK'; payload: { currentTime: number } }
  | {
      type: 'PROGRESS';
      payload: { currentTime: number; isLive: boolean; liveEdge: number };
    };

export interface JoinRoomPayload {
  roomId: string;
}
