import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { Movie } from '../movie/entities/movie.entity';
import { Person } from '../person/person.entity';

export enum ResourceType {
  IMAGE = 'image',
  RAW = 'raw',
  VIDEO = 'video',
  AUTO = 'auto',
}

@Entity({ name: modelNames.IMAGE })
export class Image {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, { onDelete: 'CASCADE', nullable: true })
  movie: Movie

  @OneToOne(() => Person, { onDelete: 'CASCADE', nullable: true })
  person: Person;

  @Column()
  @IsNotEmpty()
  @IsString()
  url: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  server_path?: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  alt: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  width?: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  height?: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
