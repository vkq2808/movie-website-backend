import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.FAVORITE })
@Index(['user', 'movie'], { unique: true })
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.favorites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Movie, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
