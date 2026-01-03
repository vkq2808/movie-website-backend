import { PartialType } from '@nestjs/mapped-types';
import { CreateListDto } from './create-list.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { Visibility } from '../entities/movie-list.entity';

export class UpdateListDto extends PartialType(CreateListDto) {
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}
