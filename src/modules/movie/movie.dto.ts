import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  IsUUID,
  IsArray,
  IsEnum,
} from 'class-validator';
import { MovieStatus } from '@/common/enums';

/**
 * Data Transfer Object for creating a movie
 */

class ImageDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  alt: string;
}

class GenreDto {
  @IsUUID(4)
  @IsOptional()
  id: string;

  @IsArray()
  names: NameDto[];
}

class NameDto {
  @IsString()
  @IsNotEmpty()
  iso_639_1: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

class KeywordDto {
  @IsUUID(4)
  @IsOptional()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateMovieDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsBoolean()
  adult?: boolean;

  @IsArray()
  @IsOptional()
  posters?: ImageDto;

  @IsArray()
  @IsOptional()
  backdrops?: ImageDto;

  @IsOptional()
  @IsDateString()
  release_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  vote_average?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vote_count?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  popularity?: number;

  @IsOptional()
  @IsBoolean()
  video?: boolean;

  @IsOptional()
  @IsString()
  original_title?: string;

  @IsOptional()
  @IsNumber()
  original_id?: number;

  @IsArray()
  genress?: GenreDto[];
}

/**
 * Data Transfer Object for updating a movie
 */
export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsArray()
  @IsOptional()
  genres?: GenreDto[];

  @IsArray()
  @IsOptional()
  keywords?: KeywordDto[];

  @IsArray()
  @IsOptional()
  backdrops?: ImageDto[];

  @IsArray()
  @IsOptional()
  posters?: ImageDto[];
}

// Query DTO for movie list endpoint
export class MovieListQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  genres?: string | string[];

  // Filter by keyword original_id(s); accepts comma-separated or repeated
  @IsOptional()
  @IsString()
  keywords?: string | string[];

  @IsOptional()
  @IsString()
  production_company?: string;

  @IsOptional()
  @IsString()
  original_language?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsString()
  release_year?: string;

  @IsOptional()
  @IsString()
  min_vote_average?: string;

  @IsOptional()
  @IsString()
  max_vote_average?: string;

  @IsOptional()
  @IsString()
  min_popularity?: string;

  @IsOptional()
  @IsString()
  max_popularity?: string;

  // Runtime range (minutes)
  @IsOptional()
  @IsString()
  min_runtime?: string;

  @IsOptional()
  @IsString()
  max_runtime?: string;

  // Price range
  @IsOptional()
  @IsString()
  min_price?: string;

  @IsOptional()
  @IsString()
  max_price?: string;

  // Presence flags
  @IsOptional()
  @IsString()
  has_video?: string;

  @IsOptional()
  @IsString()
  has_backdrop?: string;

  @IsOptional()
  @IsString()
  has_poster?: string;

  @IsOptional()
  @IsString()
  adult?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sort_by?: string;

  @IsOptional()
  @IsString()
  sort_order?: string;
}
