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
  url: string;

  @AfterLoad()
  fixVideoUrl() {
    if (!this.url || !this.site) return;
    this.url = this.updateUrl(this.url, this.site);
  }

  @Column({ type: 'text', nullable: true })
  thumbnail?: string;

  @AfterLoad()
  fixThumbnailUrl() {
    if (!this.thumbnail) return undefined;
    if (/^https?:\/\//.test(this.thumbnail)) return;
    this.thumbnail = process.env.BASE_URL + this.thumbnail;
  }

  @Column({ type: 'text', nullable: true })
  site: string;

  @Column({ type: 'float', default: -1 })
  duration: number;

  @Column({ type: 'enum', enum: VideoType })
  type: VideoType;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  qualities: VideoQualityClass[];

  @AfterLoad()
  fixQualitiesUrls() {
    if (!this.url || !this.site) return;
    return this.qualities.map((q) => ({
      url: this.updateUrl(q.url, this.site),
      quality: q.quality,
    }));
  }

  @Column({ default: true })
  official: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  private updateUrl(url: string, site: string) {
    switch (site.toLowerCase()) {
      case 'youtube':
        // Định dạng nhúng chuẩn của YouTube
        // https://www.youtube.com/embed/<videoId>
        return `https://www.youtube.com/embed/${url}`;

      case 'vimeo':
        // Định dạng nhúng chuẩn của Vimeo
        // https://player.vimeo.com/video/<videoId>
        return `https://player.vimeo.com/video/${url}`;

      case 'dailymotion':
        // Định dạng nhúng chuẩn của Dailymotion
        // https://www.dailymotion.com/embed/video/<videoId>
        return `https://www.dailymotion.com/embed/video/${url}`;
      case 'local':
        return `${process.env.BASE_URL}/video/stream/${url}`;
      case 'r2':
        return `${process.env.BASE_URL}/video/r2/stream/${url}`;
      default:
        return url;
    }
  }
}

export class VideoQualityClass {
  url: string;
  quality: VideoQuality;
}
