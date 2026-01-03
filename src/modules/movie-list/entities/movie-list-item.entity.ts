import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Column,
  Index,
  JoinColumn,
} from 'typeorm';
import { MovieList } from './movie-list.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.MOVIE_LIST_ITEM })
@Index('uq_movie_list_item_list_movie', ['list', 'movie'], { unique: true })
export class MovieListItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MovieList, (l) => l.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list: MovieList;

  @ManyToOne(() => Movie, { eager: true })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  // optional position for ordering
  @Column({ type: 'int', nullable: true })
  position?: number;

  @CreateDateColumn()
  created_at: Date;
}
