import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ToggleFavoriteDto {
  @IsNotEmpty({ message: 'movieId is required' })
  @IsUUID('4', { message: 'movieId must be a valid UUID' })
  movieId: string;
}
