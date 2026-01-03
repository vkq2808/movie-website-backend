import { IsNotEmpty, IsUUID } from 'class-validator';

export class PurchaseMovieDto {
  @IsNotEmpty({ message: 'Movie ID is required' })
  @IsUUID('4', { message: 'Movie ID must be a valid UUID' })
  movie_id: string;
}

export class MoviePurchaseResponseDto {
  id: string;
  movie_id: string;
  movie_title: string;
  purchase_price: number;
  purchased_at: Date;
  movie_poster:string;
  movie_backdrop:string;
  created_at: Date;
}
