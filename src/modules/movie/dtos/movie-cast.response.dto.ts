import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';
import {
  ProfileImageResponseDto,
  PersonResponseDto,
} from './movie-crew.response.dto';

export class MovieCastMemberResponseDto {
  @Expose()
  @IsUUID(4)
  id: string;

  @Expose()
  @IsString()
  character: string;

  @Expose()
  @IsNumber()
  order: number;

  @Expose()
  @IsOptional()
  @IsString()
  credit_id?: string;

  @Expose()
  @Type(() => PersonResponseDto)
  person: PersonResponseDto;
}

export class MovieCastResponseDto {
  @Expose()
  @IsUUID(4)
  movie_id: string;

  @Expose()
  @IsArray()
  @Type(() => MovieCastMemberResponseDto)
  cast: MovieCastMemberResponseDto[];
}
