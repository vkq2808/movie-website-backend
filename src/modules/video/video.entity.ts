import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDate,
  IsEnum,
} from 'class-validator';
import { Movie } from '../movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';
import { VideoQuality, VideoType } from '@/common/enums';
import { WatchProvider } from '../watch-provider/watch-provider.entity';

@Entity({ name: modelNames.VIDEO })
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, (movie) => movie.videos)
  movie: Movie;

  @ManyToOne(() => WatchProvider, (wp) => wp.videos, { nullable: true })
  watch_provider: WatchProvider;

  @Column({ type: 'text', nullable: true })
  @IsString()
  iso_639_1?: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  iso_3166_1?: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  key: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  preview_url: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  site: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  size?: number;

  @Column({ type: 'float', default: -1 })
  @IsNumber()
  duration: number;

  @Column({ type: 'enum', enum: VideoType })
  @IsEnum(VideoType, { message: "Invalid video type" })
  @IsNotEmpty()
  type: VideoType

  @Column({ type: 'enum', enum: VideoQuality })
  @IsEnum(VideoQuality, { message: "Invalid video quality" })
  @IsNotEmpty()
  quality: VideoQuality

  @Column({ default: true })
  @IsBoolean()
  official: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
