import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsBoolean,
  IsString,
} from 'class-validator';

export class UpdateWatchPartyDto {
  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_participants?: number;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

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
