import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Movie } from './movie.entity';

@Entity('alternative_overviews')
export class AlternativeOverview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  overview: string;

  @Column({ length: 10 })
  language_code: string;

  @ManyToOne(() => Movie, movie => movie.alternative_overviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;
}
