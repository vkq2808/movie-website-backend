import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Visibility } from '../entities/movie-list.entity';

export class CreateAndAddDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsNotEmpty()
  @IsUUID()
  movieId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
