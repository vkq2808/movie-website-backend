import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Movie } from './movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.ALTERNATIVE_TITLE_MODEL_NAME })
export class AlternativeTitle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  title: string;

  @Column()
  @IsNotEmpty({ message: 'ISO 3166-1 country code is required' })
  @IsString()
  country_code: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  type: string;

  @ManyToOne(() => Movie, movie => movie.alternative_titles, {
    onDelete: 'CASCADE',
    nullable: false
  })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
