import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';
import { Voucher } from '../voucher/entities/voucher.entity';

@Entity({ name: modelNames.MOVIE_PURCHASE })
@Unique(['user', 'movie'])
export class MoviePurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.movie_purchases)
  @JoinColumn({ name: 'user_id' })
  @IsNotEmpty({ message: 'User is required' })
  user: User;

  @ManyToOne(() => Movie, (movie) => movie.purchases)
  @JoinColumn({ name: 'movie_id' })
  @IsNotEmpty({ message: 'Movie is required' })
  movie: Movie;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNotEmpty({ message: 'Purchase price is required' })
  @IsNumber()
  @Min(0)
  purchase_price: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  purchased_at: Date;

  @ManyToOne(() => Voucher, { nullable: true })
  @JoinColumn({ name: 'voucher_id' })
  voucher?: Voucher; // Mã giảm giá đã áp dụng

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number; // số tiền được giảm thực tế

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
