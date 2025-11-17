import { VideoQuality, VideoType } from '@/common/enums';
import { Video } from './video.entity';
import { Movie } from '../movie/entities/movie.entity';
import { WatchProvider } from '@/modules/watch-provider/watch-provider.entity';
import { WatchProviderResponseDto } from '../watch-provider/watch-provider.dto';
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsUUID } from 'class-validator';

export class VideoResponseDto {
  id: string;
  iso_639_1?: string;
  iso_3166_1?: string;
  name?: string;
  url: string;
  site: string;
  type: VideoType;
  qualities?: {
    url: string;
    quality: VideoQuality;
  }[];
  official: boolean;
  thumbnail: string;
  waitch_provider: WatchProviderResponseDto;
  movie: {
    id: string;
  };

  static fromEntity(video: Video) {
    const dto = new VideoResponseDto();
    Object.assign(dto, video);
    return dto;
  }
}

export class InitUploadVideoDto {
  movie_id: string;
  filename: string;
  total_chunks?: number;
  filesize?: number;
  title: string;
  type: VideoType;
  provider: WatchProviderResponseDto;
}

export class CreateVideoDto {
  movie: Movie | string;
  watch_provider: WatchProvider | string;
  type: VideoType;
  name: string;
  url: string;
  site: string;
  qualities?: {
    url: string;
    quality: VideoQuality;
  }[];
  official?: boolean;
}

export class UpdateVideoDto extends PartialType(CreateVideoDto) {
  id: string;
  thumbnail?: string;
}
