import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  Index,
} from 'typeorm';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { Movie } from '../movie/entities/movie.entity';

@Entity({ name: modelNames.KEYWORD })
@Index('idx_keyword_name', ['name'], { unique: true })
export class Keyword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  @IsInt()
  @IsNotEmpty()
  original_id: number; // TMDB keyword id

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ManyToMany(() => Movie, (movie) => movie.keywords)
  movies: Movie[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
