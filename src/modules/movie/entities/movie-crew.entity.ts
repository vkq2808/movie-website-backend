import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Movie } from './movie.entity';
import { Person } from '../../person/person.entity';
import { modelNames } from '@/common/constants/model-name.constant';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@Entity({ name: modelNames.MOVIE_CREW })
@Index(['movie', 'person', 'department', 'job'], { unique: true })
export class MovieCrew {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, (m) => m.crew, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @ManyToOne(() => Person, (p) => p.crew_credits, { eager: true })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @Column({ type: 'varchar', length: 100 })
  @IsString()
  @IsNotEmpty()
  department: string; // e.g., Directing, Writing, Production

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsString()
  job?: string; // e.g., Director, Writer

  @Column({ type: 'float', nullable: true })
  @IsOptional()
  popularity?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
