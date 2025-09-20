import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDecimal,
  IsUrl,
  IsInt,
} from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { AvailabilityType } from '@/common/enums';
import { Movie } from '../movie/entities/movie.entity';
import { WatchProvider } from './watch-provider.entity';

@Entity({ name: modelNames.MOVIE_WATCH_PROVIDER })
@Index(['movie', 'watch_provider', 'availability_type', 'region'], {
  unique: true,
})
export class MovieWatchProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relationship to Movie
  @ManyToOne(() => Movie, { eager: false })
  @JoinColumn({ name: 'movie_id' })
  @IsNotEmpty({ message: 'Movie is required' })
  movie: Movie;

  // Relationship to WatchProvider
  @ManyToOne(
    () => WatchProvider,
    (watchProvider) => watchProvider.movie_watch_providers,
    { eager: true },
  )
  @JoinColumn({ name: 'watch_provider_id' })
  @IsNotEmpty({ message: 'Watch provider is required' })
  watch_provider: WatchProvider;

  @Column({ type: 'enum', enum: AvailabilityType })
  @IsNotEmpty({ message: 'Availability type is required' })
  @IsEnum(AvailabilityType, { message: 'Invalid availability type' })
  availability_type: AvailabilityType;

  @Column({ type: 'varchar', length: 10, default: 'US' })
  @IsOptional()
  @IsString()
  region: string; // ISO country code (e.g., 'US', 'GB', 'JP')

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @IsOptional()
  @IsDecimal(
    { decimal_digits: '2' },
    { message: 'Price must have at most 2 decimal places' },
  )
  price: number;

  @Column({ type: 'varchar', length: 3, nullable: true })
  @IsOptional()
  @IsString()
  currency: string; // Currency code (e.g., 'USD', 'EUR', 'JPY')

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Watch URL must be a valid URL' })
  watch_url: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @IsOptional()
  @IsString()
  quality: string; // HD, SD, 4K, etc.

  @Column({ type: 'varchar', length: 20, nullable: true })
  @IsOptional()
  @IsString()
  audio_language: string; // ISO language code

  @Column({ type: 'varchar', length: 500, nullable: true })
  @IsOptional()
  @IsString()
  subtitle_languages: string; // Comma-separated ISO language codes

  @Column({ type: 'boolean', default: true })
  @IsOptional()
  is_available: boolean;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  available_from: Date;

  @Column({ type: 'timestamp', nullable: true })
  @IsOptional()
  available_until: Date;

  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsInt()
  original_provider_id: number; // ID from external provider API

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
