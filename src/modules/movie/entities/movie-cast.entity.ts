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
import { IsInt, IsOptional, IsString } from 'class-validator';

@Entity({ name: modelNames.MOVIE_CAST })
@Index(['movie', 'person', 'character'], { unique: true })
export class MovieCast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, (m) => m.cast, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @ManyToOne(() => Person, (p) => p.cast_credits, {
    cascade: true,
    eager: true,
  })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsOptional()
  @IsString()
  character?: string;

  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsInt()
  order?: number;

  @Column({ type: 'float', nullable: true })
  @IsOptional()
  popularity?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
