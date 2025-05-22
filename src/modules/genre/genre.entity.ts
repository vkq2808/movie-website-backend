import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { Movie } from '../movie/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.GENRE_MODEL_NAME })
export class Genre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty({ message: 'Please enter the name of the genre' })
  @IsString()
  name: string;

  @Column({ unique: true })
  @IsNotEmpty({ message: 'Please enter the slug of the genre' })
  @IsString()
  slug: string;

  @ManyToMany(() => Movie, movie => movie.genres)
  movies: Movie[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}