import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Movie } from './movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.ALTERNATIVE_TAGLINE })
export class AlternativeTagline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  tagline: string;

  @Column({ length: 10 })
  iso_639_1: string;

  @ManyToOne(() => Movie, (movie) => movie.alternative_taglines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;
}
