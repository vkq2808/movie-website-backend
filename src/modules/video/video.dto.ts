import { VideoQuality, VideoType } from '@/common/enums';
import { Video } from './video.entity';

export class VideoResponseDto {
  id: string;
  iso_639_1?: string;
  iso_3166_1?: string;
  name?: string;
  key: string;
  site: string;
  size?: number;
  type: VideoType;
  quality: VideoQuality;
  official: boolean;
  embed_url: string;
  thumbnail_url: string;
  preview_url: string;

  static fromEntity(video: Video): VideoResponseDto {
    const dto = new VideoResponseDto();
    Object.assign(dto, video);

    // Generate embed URL based on video site
    switch (video.site.toLowerCase()) {
      case 'youtube':
        dto.embed_url = `https://www.youtube-nocookie.com/embed/${video.key}?origin=${process.env.FRONTEND_URL || '*'}`;
        dto.thumbnail_url = `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`;
        break;
      case 'vimeo':
        dto.embed_url = `https://player.vimeo.com/video/${video.key}`;
        dto.thumbnail_url = ''; // Vimeo requires API call to get thumbnail
        break;
      default:
        dto.embed_url = '';
        dto.thumbnail_url = '';
    }

    return dto;
  }
}