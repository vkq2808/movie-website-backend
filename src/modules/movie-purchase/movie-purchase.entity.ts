import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { User } from '../auth/user.entity';
import { Movie } from '../movie/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.MOVIE_PURCHASE_MODEL_NAME })
@Unique(['user', 'movie'])
export class MoviePurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.movie_purchases)
  @IsNotEmpty({ message: 'User is required' })
  user: User;

  @ManyToOne(() => Movie, (movie) => movie.purchases)
  @IsNotEmpty({ message: 'Movie is required' })
  movie: Movie;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNotEmpty({ message: 'Purchase price is required' })
  @IsNumber()
  @Min(0)
  purchase_price: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  purchased_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
