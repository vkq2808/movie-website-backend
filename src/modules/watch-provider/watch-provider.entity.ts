import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { MovieWatchProvider } from './movie-watch-provider.entity';

@Entity({ name: modelNames.WATCH_PROVIDER_MODEL_NAME })
export class WatchProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @IsNotEmpty({ message: 'Provider name is required' })
  @IsString()
  provider_name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @IsNotEmpty({ message: 'Provider slug is required' })
  @IsString()
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsString()
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  logo_url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Website URL must be a valid URL' })
  website_url: string;

  @Column({ type: 'int', unique: true })
  @IsNotEmpty({ message: 'Original provider ID is required' })
  @IsInt()
  original_provider_id: number;

  @Column({ type: 'int', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  display_priority: number;

  @Column({ type: 'boolean', default: true })
  @IsOptional()
  is_active: boolean;

  // Relationship to movie watch providers
  @OneToMany(
    () => MovieWatchProvider,
    (movieWatchProvider) => movieWatchProvider.watch_provider,
  )
  movie_watch_providers: MovieWatchProvider[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
