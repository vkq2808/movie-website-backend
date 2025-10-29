import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  AfterLoad,
} from 'typeorm';
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
  iso_639_1?: string;

  @Column({ type: 'text', nullable: true })
  iso_3166_1?: string;

  @Column({ type: 'text', nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  key: string;

  @Column({ type: 'text', nullable: true })
  thumbnail?: string;

  @AfterLoad()
  fixThumbnailUrl() {
    if (!this.thumbnail) return undefined;
    if (/^https?:\/\//.test(this.thumbnail)) return;
    return process.env.BASE_URL + this.thumbnail;
  }

  @Column()
  site: string;

  @Column({ nullable: true })
  size?: number;

  @Column({ type: 'float', default: -1 })
  duration: number;

  @Column({ type: 'enum', enum: VideoType })
  type: VideoType;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  qualities: VideoQualityClass[];

  @Column({ default: true })
  official: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

export class VideoQualityClass {
  key: string;
  quality: VideoQuality;
}
