/**
 * DTOs for Watch Party WebSocket Payloads
 *
 * Used for validation and type safety on the server side
 */

import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

/**
 * DTO for joining a watch party room
 */
export class JoinRoomDto {
  @IsString()
  roomId: string;
}

/**
 * DTO for play event
 *
 * When host starts playback or resumes from pause
 */
export class PlayDto {
  @IsString()
  roomId: string;

  @IsNumber()
  @IsOptional()
  position?: number; // seconds
}

/**
 * DTO for pause event
 *
 * When host pauses playback
 */
export class PauseDto {
  @IsString()
  roomId: string;

  @IsNumber()
  @Min(0)
  position: number; // seconds
}

/**
 * DTO for seek event
 *
 * When host seeks to new position
 */
export class SeekDto {
  @IsString()
  roomId: string;

  @IsNumber()
  @Min(0)
  position: number; // seconds
}

/**
 * DTO for start event
 *
 * When host initiates playback with initial sync timestamp
 */
export class StartDto {
  @IsString()
  roomId: string;

  @IsNumber()
  @Min(0)
  startTime: number; // milliseconds (Date.now())
}

/**
 * DTO for progress update event
 *
 * Sent periodically by host for anti-desync (every ~5 seconds)
 */
export class ProgressUpdateDto {
  @IsString()
  roomId: string;

  @IsNumber()
  @Min(0)
  progress: number; // seconds

  @IsNumber()
  @IsOptional()
  timestamp?: number; // milliseconds, server timestamp for clock skew compensation
}
