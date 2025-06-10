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

  poster: any;

  backdrop: any;

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
  original_language: any;

  @IsOptional()
  @IsString()
  original_title?: string;

  @IsNumber()
  original_id: number;

  genres: any[];

  @IsString()
  imdb_id: string;

  spoken_languages: any[];

  alternativeTitles: any[];
}
