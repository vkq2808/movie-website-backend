import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsEnum,
  ValidateIf,
  IsString,
} from 'class-validator';

export enum EventType {
  RANDOM = 'random',
  SCHEDULED = 'scheduled',
  RECURRING = 'recurring',
}

export enum RecurrenceType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class CreateAdminWatchPartyDto {
  @IsNotEmpty({ message: 'Movie ID is required' })
  @IsUUID(4, { message: 'Movie ID must be a valid UUID' })
  movie_id: string;

  @IsNotEmpty({ message: 'Event type is required' })
  @IsEnum(EventType, { message: 'Event type must be random, scheduled, or recurring' })
  event_type: EventType;

  @ValidateIf((o) => o.event_type === EventType.SCHEDULED || o.event_type === EventType.RECURRING)
  @IsNotEmpty({ message: 'Scheduled start time is required for scheduled or recurring events' })
  @IsDateString({}, { message: 'Scheduled start time must be a valid ISO date string' })
  scheduled_start_time?: string;

  @ValidateIf((o) => o.event_type === EventType.RECURRING)
  @IsNotEmpty({ message: 'Recurrence type is required for recurring events' })
  @IsEnum(RecurrenceType, { message: 'Recurrence type must be daily, weekly, or monthly' })
  recurrence_type?: RecurrenceType;

  @ValidateIf((o) => o.event_type === EventType.RECURRING)
  @IsOptional()
  @IsDateString({}, { message: 'Recurrence end date must be a valid ISO date string' })
  recurrence_end_date?: string;

  @ValidateIf((o) => o.event_type === EventType.RECURRING)
  @IsOptional()
  @IsNumber({}, { message: 'Recurrence count must be a number' })
  @Min(1, { message: 'Recurrence count must be at least 1' })
  @Max(365, { message: 'Recurrence count cannot exceed 365' })
  recurrence_count?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Max participants must be a number' })
  @Min(1, { message: 'Max participants must be at least 1' })
  max_participants?: number;

  @IsOptional()
  @IsBoolean({ message: 'Is featured must be a boolean' })
  is_featured?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'Ticket price must be a number' })
  @Min(0, { message: 'Ticket price cannot be negative' })
  ticket_price?: number;

  @IsOptional()
  @IsString({ message: 'Ticket description must be a string' })
  ticket_description?: string;
}

