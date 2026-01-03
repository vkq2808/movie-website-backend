import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class AddMovieDto {
  @IsNotEmpty()
  @IsUUID()
  movieId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
