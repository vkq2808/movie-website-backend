import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinTable,
} from 'typeorm';
import { IsNotEmpty, IsString, IsDateString, IsUrl } from 'class-validator';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.ACTOR_MODEL_NAME })
export class Actor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @Column({ type: 'text' })
  @IsNotEmpty({ message: 'Biography is required' })
  @IsString()
  biography: string;
  @Column({ type: 'date' })
  @IsNotEmpty({ message: 'Birth date is required' })
  @IsDateString()
  birth_date: Date;

  @Column({ nullable: true })
  @IsUrl({}, { message: 'Photo URL must be a valid URL' })
  photo_url: string;

  @ManyToMany(() => Movie)
  @JoinTable({ name: 'actor_movies' })
  movies: Movie[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
