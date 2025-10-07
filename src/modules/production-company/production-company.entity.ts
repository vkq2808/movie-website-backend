import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
} from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { Movie } from '../movie/entities/movie.entity';

@Entity({ name: modelNames.PRODUCTION_COMPANY })
export class ProductionCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @IsNotEmpty({ message: 'Company name is required' })
  @IsString()
  name: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Homepage URL must be a valid URL' })
  homepage: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsString()
  headquarters: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsString()
  origin_country: string;

  @Column({ type: 'int', unique: true })
  @IsNotEmpty({ message: 'Original company ID is required' })
  @IsInt()
  original_id: string;

  @Column({ type: 'boolean', default: true })
  @IsOptional()
  is_active: boolean;

  // Many-to-many relationship with movies
  @ManyToMany(() => Movie, (movie) => movie.production_companies)
  movies: Movie[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
