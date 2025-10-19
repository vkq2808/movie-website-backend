import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.FEEDBACK })
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.feedbacks)
  @IsNotEmpty({ message: 'UserId is required' })
  user: User;

  @ManyToOne(() => Movie)
  @IsNotEmpty({ message: 'MovieId is required' })
  movie: Movie;
  @Column({ type: 'text' })
  @IsNotEmpty({ message: 'Feedback is required' })
  @IsString()
  feedback: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
