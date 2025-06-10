import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { Movie } from '../movie/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.DIRECTOR_MODEL_NAME })
export class Director {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany(() => Movie)
  movies: Movie[];

  @Column()
  @IsNotEmpty({ message: 'Please enter your name' })
  @IsString()
  name: string;

  @Column({ type: 'text' })
  @IsNotEmpty({ message: 'Please enter your biography' })
  @IsString()
  biography: string;
  @Column({ type: 'timestamp' })
  @IsNotEmpty({ message: 'Please enter your date of birth' })
  @IsDate()
  birth_date: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsUrl()
  photo_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
