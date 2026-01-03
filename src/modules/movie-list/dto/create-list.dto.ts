import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { Visibility } from '../entities/movie-list.entity';

export class CreateListDto {
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
}
