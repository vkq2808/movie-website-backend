import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';

export class FilterWatchPartyDto {
  @IsOptional()
  @IsString()
  movie_title?: string;

  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;
}
