import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  feedback: string;
}

export class UpdateFeedbackDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(500)
  feedback?: string;
}

export class GetCommentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class GetAdminFeedbacksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'hidden' | 'all';
}
