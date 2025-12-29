/**
 * Shared Watch Party Types - Backend
 *
 * Units Convention:
 * - startTime: milliseconds (epoch, Date.now())
 * - progress/currentTime/videoTimestamp: seconds (floating point)
 * - timestamp: milliseconds (Date.now())
 */

/**
 * Participant in a watch party room
 */
export interface WatchPartyParticipant {
  /** User ID */
  id: string;
  /** Username for display */
  username: string;
  /** Optional avatar URL */
  avatar?: string;
}

/**
 * Chat/Log message in watch party
 */
export interface WatchPartyLogMessage {
  id: string;
  event_type: 'message' | 'join' | 'leave' | 'play' | 'pause' | 'seek' | 'like';
  content: Record<string, unknown>;
  /** Real time when event occurred (ISO string or Date) */
  real_time: string | Date;
  /** Seconds into video when event occurred */
  event_time: number;
  user?: {
    id: string;
    username: string;
    avatar?: string;
  };
}

/**
 * Host-to-room: "Start playback" event payload
 * Emitted when host initiates streaming (beginning or resume from pause)
 *
 * Units: startTime in milliseconds (Date.now())
 */
export interface WatchPartyStartPayload {
  /** Epoch milliseconds when playback begins */
  startTime: number;
}

/**
 * Host-to-room: "Seek" event payload
 * Emitted when host seeks to a new position
 *
 * Units: position in seconds
 */
export interface WatchPartySeekPayload {
  /** Seconds into video to seek to */
  position: number;
}

/**
 * Host-to-room: "Progress update" event payload
 * Emitted periodically (e.g., every 5 seconds) for anti-desync
 *
 * Units: progress in seconds, timestamp in milliseconds
 */
export interface WatchPartyProgressUpdatePayload {
  /** Current video position in seconds */
  progress: number;
  /** Server timestamp (ms) when progress was recorded, for client clock skew compensation */
  timestamp?: number;
}

/**
 * Initial room state when client joins
 * Server broadcasts this on 'watch_party:join_response'
 *
 * Units: startTime in ms, progress/currentPosition in seconds
 */
export interface WatchPartyRoomState {
  /** Unique room ID (same as party ID) */
  roomId: string;
  /** Current playback status */
  isPlaying: boolean;
  /** Start time in milliseconds (Date.now() equivalent) - null if not started */
  startTime: number | null;
  /** Current video position in seconds (when paused or for reference) */
  progress: number;
  /** Stream URL for HLS playback */
  streamUrl: string;
  /** Current participants */
  participants: WatchPartyParticipant[];
  /** Recent chat messages */
  messages: WatchPartyLogMessage[];
  /** Like counts by user */
  totalLikes: {
    [userId: string]: number;
    total: number;
  };
  /** Host user ID */
  hostId: string;
}

/**
 * Anti-desync configuration
 */
export const ANTI_DESYNC_CONFIG = {
  /** Threshold in seconds; if client is more than this off, trigger seek */
  THRESHOLD_SECONDS: 1.5,

  /** How often host sends progress updates (milliseconds) */
  PROGRESS_UPDATE_INTERVAL_MS: 5000,

  /** How often client checks desync (milliseconds) */
  CLIENT_CHECK_INTERVAL_MS: 2000,
};

/**
 * Live video player configuration
 */
export const LIVE_VIDEO_CONFIG = {
  /** Segment duration in seconds (used for preload calculations) */
  SEGMENT_DURATION_SECONDS: 4,

  /** How many segments to keep in buffer before current */
  BACK_BUFFER_SECONDS: 60,

  /** Max buffer ahead of current position */
  MAX_BUFFER_LENGTH_SECONDS: 30,
};
