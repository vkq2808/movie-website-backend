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
} from 'class-validator';
import { Image } from '../image/image.entity';
import { Language } from '../language/language.entity';
import { Genre } from '../genre/genre.entity';

/**
 * Data Transfer Object for creating a movie
 */
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

  @IsOptional()
  @IsString()
  poster_url?: string;

  @IsOptional()
  @IsString()
  backdrop_url?: string;

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
  language_iso_code?: string;

  @IsOptional()
  @IsString()
  original_title?: string;

  @IsOptional()
  @IsNumber()
  original_id?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  genre_ids?: string[];

  @IsOptional()
  @IsString()
  imdb_id?: string;
}

/**
 * Data Transfer Object for updating a movie
 */
export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  languageIsoCode: string;
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

/**
 * Data Transfer Object for movie response
 */
export class MovieResponseDto {
  @IsUUID('4')
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsBoolean()
  adult: boolean;

  poster: Image | null;

  backdrop: Image | null;

  @IsOptional()
  @IsDateString()
  release_date?: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  vote_average: number;

  @IsNumber()
  @Min(0)
  vote_count: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  popularity: number;

  @IsBoolean()
  video: boolean;

  // Using optional to allow passing either the Language entity or a string language code
  @IsOptional()
  original_language: Language | string | null;

  @IsOptional()
  @IsString()
  original_title?: string;

  @IsNumber()
  original_id: number;

  genres: Genre[];

  @IsString()
  imdb_id: string;

  spoken_languages: Language[];

  alternativeTitles: { iso_639_1: string; title: string }[];
}
