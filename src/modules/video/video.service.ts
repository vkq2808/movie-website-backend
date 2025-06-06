import { modelNames } from '@/common/constants/model-name.constant';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from './video.entity';
import * as fs from 'fs';
import * as path from 'path';
import { Movie } from '../movie/movie.entity';
import { api } from '@/common/utils';

interface StreamResponse {
  stream: fs.ReadStream;
  contentLength: number;
  headers: {
    statusCode: number;
    contentRange: string;
  };
}

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {
    // this.init();
  }

  async createVideoStream(
    videoPath: string,
    range?: string,
  ): Promise<StreamResponse> {
    // Ensure path is safe and within videos directory
    const safePath = path.normalize(videoPath).replace(/^(\.\.[\/\\])+/, '');
    const videoFilePath = path.join(process.cwd(), 'src', 'videos', safePath);

    if (!fs.existsSync(videoFilePath)) {
      throw new NotFoundException('Video not found');
    }

    const videoSize = fs.statSync(videoFilePath).size;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(videoFilePath, { start, end });

      return {
        stream,
        contentLength: chunkSize,
        headers: {
          statusCode: 206,
          contentRange: `bytes ${start}-${end}/${videoSize}`,
        },
      };
    }

    const stream = fs.createReadStream(videoFilePath);
    return {
      stream,
      contentLength: videoSize,
      headers: {
        statusCode: 200,
        contentRange: `bytes 0-${videoSize - 1}/${videoSize}`,
      },
    };
  }

  async getVideoByPath(video_path: string) {
    const videoPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'videos',
      video_path,
    );
    if (!fs.existsSync(videoPath)) {
      return null;
    }
    return fs.createReadStream(videoPath);
  }

  async init() {
    const movies = await this.movieRepository.find();

    for (const movie of movies) {
      try {
        const videos = await api.get<{ id: string; results: any[] }>(
          `/movie/${movie.id}/videos`,
        );
        if (!videos.data?.results) continue;

        // Delete existing videos for this movie
        await this.videoRepository.delete({ movie: { id: movie.id } });

        // Create and save new videos
        const videoPromises = videos.data.results.map(async (videoData) => {
          const video = this.videoRepository.create({
            iso_649_1: videoData.iso_649_1,
            iso_3166_1: videoData.iso_3166_1,
            name: videoData.name,
            key: videoData.key,
            site: videoData.site,
            size: videoData.size,
            type: videoData.type,
            official: videoData.official,
            published_at: new Date(),
          });

          // Set the movie relationship
          video.movie = movie;

          return await this.videoRepository.save(video);
        });

        await Promise.all(videoPromises);

        // No need to update movie.videos as the relationship is maintained by TypeORM
      } catch (error) {
        console.error(`Error processing videos for movie ${movie.id}:`, error);
      }
    }
  }

  async findVideosByMovieId(movieId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { movie: { id: movieId } },
      order: { created_at: 'DESC' },
    });
  }
}
