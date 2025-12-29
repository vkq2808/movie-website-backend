import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { modelNames } from '@/common/constants/model-name.constant';
import { User } from '../../user/user.entity';
import { Movie } from '../../movie/entities/movie.entity';

@Entity({ name: 'movie_view_logs' })
@Index('idx_user_movie_view', ['user', 'movie'])
@Index('idx_movie_view', ['movie'])
@Index('idx_user_view', ['user'])
export class MovieViewLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Movie, (movie) => movie.id, { onDelete: 'CASCADE' })
  movie: Movie;

  /**
   * Business rule:
   * A movie view is counted when an authenticated user successfully starts
   * streaming a MOVIE-type video. Replays within the same session are ignored.
   * This timestamp tracks the first view of the movie by the user.
   */
  @CreateDateColumn()
  viewed_at: Date;
}
