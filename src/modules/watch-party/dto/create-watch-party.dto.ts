import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateWatchPartyDto {
  @IsUUID()
  @IsNotEmpty()
  host_id: string;

  @IsNotEmpty()
  @IsUUID()
  movie_id: string;

  @IsNotEmpty()
  @IsDateString()
  start_time: string;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_participants?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ticket_price?: number;

  @IsOptional()
  @IsString()
  ticket_description?: string;

  @IsOptional()
  @IsString()
  recurrence?: string;
}
