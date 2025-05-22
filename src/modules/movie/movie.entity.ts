import { Entity, Column, PrimaryGeneratedColumn, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { IsNotEmpty, IsString, IsNumber, Min, Max, IsArray, IsOptional } from 'class-validator';
import { Genre } from '../genre/genre.entity';
import { Video } from '../video/video.entity';
import { Image } from '../image/image.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.MOVIE_MODEL_NAME })
export class Movie {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  originalId: number;

  @Column()
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  title: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description: string;

  @ManyToOne(() => Image, { eager: true, nullable: true })
  poster: Image;

  @ManyToOne(() => Image, { eager: true, nullable: true })
  backdrop: Image;

  @Column({ type: 'date', nullable: true })
  releaseDate: Date;

  @Column({ type: 'float', default: 0 })
  @IsNumber()
  @Min(0)
  voteAverage: number;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  voteCount: number;

  @Column({ type: 'float', default: 0 })
  @IsNumber()
  @Min(0)
  popularity: number;

  @Column({ default: false })
  adult: boolean;

  @Column({ default: false })
  video: boolean;

  @Column()
  @IsString()
  originalLanguage: string;

  @Column()
  @IsString()
  originalTitle: string;

  @Column({ default: 'en-US' })
  @IsString()
  language: string;

  @ManyToMany(() => Genre, { eager: true })
  @JoinTable()
  genres: Genre[];

  @OneToMany(() => Video, video => video.movie)
  videos: Video[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}