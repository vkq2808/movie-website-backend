import { IsNotEmpty, IsString, IsOptional, IsUrl, IsInt, Min, Max, IsBoolean, IsEnum, IsDecimal, IsISO8601, IsArray } from 'class-validator';
import { AvailabilityType } from '@/common/enums';

// Watch Provider DTOs
export class CreateWatchProviderDto {
  @IsNotEmpty({ message: 'Provider name is required' })
  @IsString()
  provider_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  logo_url?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Website URL must be a valid URL' })
  website_url?: string;

  @IsNotEmpty({ message: 'Original provider ID is required' })
  @IsInt()
  original_provider_id: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  display_priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateWatchProviderDto {
  @IsOptional()
  @IsString()
  provider_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  logo_url?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Website URL must be a valid URL' })
  website_url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  display_priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// Movie Watch Provider DTOs
export class CreateMovieWatchProviderDto {
  @IsNotEmpty({ message: 'Movie ID is required' })
  @IsString()
  movie_id: string;

  @IsNotEmpty({ message: 'Watch provider ID is required' })
  @IsString()
  watch_provider_id: string;

  @IsNotEmpty({ message: 'Availability type is required' })
  @IsEnum(AvailabilityType, { message: 'Invalid availability type' })
  availability_type: AvailabilityType;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '2' }, { message: 'Price must have at most 2 decimal places' })
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Watch URL must be a valid URL' })
  watch_url?: string;

  @IsOptional()
  @IsString()
  quality?: string;

  @IsOptional()
  @IsString()
  audio_language?: string;

  @IsOptional()
  @IsString()
  subtitle_languages?: string;

  @IsOptional()
  @IsBoolean()
  is_available?: boolean;

  @IsOptional()
  @IsISO8601()
  available_from?: Date;

  @IsOptional()
  @IsISO8601()
  available_until?: Date;

  @IsOptional()
  @IsInt()
  original_provider_id?: number;
}

export class FindMovieWatchProvidersDto {
  @IsOptional()
  @IsString()
  movie_id?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(AvailabilityType, { message: 'Invalid availability type' })
  availability_type?: AvailabilityType;

  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class SyncMovieWatchProvidersDto {
  @IsNotEmpty({ message: 'Movie ID is required' })
  @IsString()
  movieId: string;

  @IsNotEmpty({ message: 'Original movie ID is required' })
  @IsInt()
  originalMovieId: number;

  @IsOptional()
  @IsString()
  region?: string;
}

export class BulkUpdateAvailabilityDto {
  @IsNotEmpty({ message: 'Region is required' })
  @IsString()
  region: string;

  @IsNotEmpty({ message: 'Availability status is required' })
  @IsBoolean()
  is_available: boolean;
}

// API Response DTOs for TMDB integration
export class WatchProviderApiResponseDto {
  @IsInt()
  id: number;

  @IsString()
  logo_path: string;

  @IsString()
  provider_name: string;

  @IsInt()
  display_priority: number;
}

export class MovieWatchProviderApiResponseDto {
  @IsOptional()
  @IsUrl()
  link?: string;

  @IsOptional()
  @IsArray()
  flatrate?: WatchProviderApiResponseDto[];

  @IsOptional()
  @IsArray()
  rent?: WatchProviderApiResponseDto[];

  @IsOptional()
  @IsArray()
  buy?: WatchProviderApiResponseDto[];

  @IsOptional()
  @IsArray()
  free?: WatchProviderApiResponseDto[];
}
