import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { User } from '../auth/user.entity';
import { Movie } from '../movie/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.WATCH_HISTORY_MODEL_NAME })
export class WatchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @IsNotEmpty({ message: 'User is required' })
  user: User;

  @ManyToOne(() => Movie)
  @IsNotEmpty({ message: 'Movie is required' })
  movie: Movie;
  @Column({ type: 'float' })
  @IsNotEmpty({ message: 'Progress is required' })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
