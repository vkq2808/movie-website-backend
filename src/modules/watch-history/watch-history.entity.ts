import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.WATCH_HISTORY })
@Index(['user', 'movie'], { unique: true })
export class WatchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  @IsNotEmpty({ message: 'User is required' })
  user: User;

  @ManyToOne(() => Movie)
  @JoinColumn({ name: 'movie_id' })
  @IsNotEmpty({ message: 'Movie is required' })
  movie: Movie;

  @Column({ type: 'float' })
  @IsNotEmpty({ message: 'Progress is required' })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @Column({ default: 0 })
  view_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
