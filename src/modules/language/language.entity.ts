import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { Movie } from '../movie/entities/movie.entity';

@Entity({ name: modelNames.LANGUAGE })
export class Language {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  @IsNotEmpty({ message: 'name is required' })
  @IsString()
  name: string;

  // English name of the language
  @Column({ type: 'varchar', unique: true })
  @IsNotEmpty({ message: 'english_name is required' })
  @IsString()
  english_name: string;

  // index this column for faster search
  @Column({ type: 'varchar', length: 4, unique: true })
  @IsNotEmpty({ message: 'code is required' })
  @IsString()
  @Index({ unique: true })
  iso_639_1: string;

  @ManyToMany(() => Movie, (movie) => movie.spoken_languages)
  movies: Movie[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
