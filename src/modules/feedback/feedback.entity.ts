import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.FEEDBACK })
@Unique(['user', 'movie'])
@Index(['status'])
@Index(['created_at'])
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.feedbacks)
  @JoinColumn({ name: 'user_id' })
  @IsNotEmpty({ message: 'UserId is required' })
  user: User;

  @ManyToOne(() => Movie)
  @JoinColumn({ name: 'movie_id' })
  @IsNotEmpty({ message: 'MovieId is required' })
  movie: Movie;

  @Column({ type: 'text' })
  @IsNotEmpty({ message: 'Feedback is required' })
  @IsString()
  feedback: string;

  @Column({
    type: 'enum',
    enum: ['active', 'hidden', 'deleted'],
    default: 'active',
  })
  status: 'active' | 'hidden' | 'deleted' = 'active';
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
