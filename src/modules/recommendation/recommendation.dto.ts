import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RecommendationType,
  RecommendationSource,
} from './recommendation.entity';
import { Movie } from '../movie/movie.entity';

export class GetRecommendationsDto {
  @IsOptional()
  @IsEnum(RecommendationType)
  type?: RecommendationType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  exclude_watched?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  exclude_purchased?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  min_score?: number = 0;
}

export class RecommendationResponseDto {
  id: string;
  movie: Movie;
  recommendation_type: RecommendationType;
  sources: RecommendationSource[];
  score: number;
  metadata: {
    matching_genres?: string[];
    matching_actors?: string[];
    matching_directors?: string[];
    matching_languages?: string[];
    user_similarity_score?: number;
    content_similarity_score?: number;
    trending_score?: number;
    reasoning?: string;
  };
  created_at: Date;
}

export class RecommendationStatsDto {
  total_recommendations: number;
  by_type: Record<RecommendationType, number>;
  by_source: Record<RecommendationSource, number>;
  average_score: number;
  last_updated: Date;
}

export class GenerateRecommendationsDto {
  @IsOptional()
  @IsEnum(RecommendationType)
  type?: RecommendationType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsBoolean()
  force_refresh?: boolean = false;
}

export class BulkGenerateRecommendationsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  user_ids?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit_per_user?: number = 50;

  @IsOptional()
  @IsBoolean()
  force_refresh?: boolean = false;
}
