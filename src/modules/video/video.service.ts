import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from './video.entity';
import * as fs from 'fs';
import * as path from 'path';
import { Movie } from '../movie/entities/movie.entity';
import * as fsPromises from 'fs/promises';
import * as stream from 'stream';
import { promisify } from 'util';
import { execSync } from 'child_process';
import { RedisService } from '@/modules/redis/redis.service';
import { VideoType, VideoQuality } from '@/common/enums';
const pipeline = promisify(stream.pipeline);
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

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
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly redisService: RedisService,
  ) {
    // this.init();
    this.s3 = new S3Client({
      region: 'auto', // Cloudflare R2 không cần region thật
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });

    this.bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
  }

  async uploadVideoCloudflareR2(file: Express.Multer.File) {
    const fileExt = path.extname(file.originalname);
    const fileName = `${crypto.randomUUID()}${fileExt}`;

    const uploadParams = {
      Bucket: this.bucket,
      Key: `videos/${fileName}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(uploadParams));

    // Public URL mà người dùng có thể xem
    const publicUrl = `${this.publicUrl}/videos/${fileName}`;
    return { fileName, publicUrl };
  }

  // Directory to store temporary upload chunks
  private getTempDir(sessionId: string) {
    return path.join(process.cwd(), 'uploads', 'tmp', 'videos', sessionId);
  }

  private getFinalDir() {
    return path.join(process.cwd(), 'src', 'videos');
  }

  async createUploadSession(sessionId: string, body: { movie_id: string; filename: string; total_chunks?: number; filesize?: number }) {
    // If filesize provided, check disk space and compute chunk plan
    const finalDir = this.getFinalDir();
    const reserveBytes = 100 * 1024 * 1024; // 100MB reserve

    let availableBytes: number | null = null;
    if (body.filesize && body.filesize > 0) {
      try {
        // use df to get available space on the filesystem containing finalDir
        const stdout = execSync(`df -k "${finalDir}"`).toString();
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          const cols = lines[1].trim().split(/\s+/);
          // df -k columns: Filesystem 1K-blocks Used Available Use% Mounted on
          const availKb = parseInt(cols[3], 10);
          availableBytes = availKb * 1024;
        }
      } catch (e) {
        // ignore df errors; leave availableBytes as null
      }

      if (availableBytes !== null) {
        const required = body.filesize + reserveBytes;
        if (availableBytes < required) {
          throw new BadRequestException('Insufficient disk space on server to accept this upload');
        }
      }
    }

    // determine chunk size and total chunks
    const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    let chunk_size = DEFAULT_CHUNK_SIZE;
    let total_chunks = body.total_chunks || null;
    if (body.filesize && body.filesize > 0) {
      total_chunks = Math.ceil(body.filesize / chunk_size);
      // if too many chunks, increase chunk size to keep chunks reasonable
      if (total_chunks > 1000) {
        chunk_size = Math.ceil(body.filesize / 500);
        total_chunks = Math.ceil(body.filesize / chunk_size);
      }
    }

    const meta = {
      sessionId,
      movie_id: body.movie_id,
      filename: body.filename,
      total_chunks: total_chunks,
      filesize: body.filesize || null,
      chunk_size,
      uploaded_chunks: [] as number[],
      created_at: Date.now(),
      updated_at: Date.now(),
      status: 'in_progress',
      available_bytes: availableBytes,
    } as any;

    // ensure temp dir
    const dir = this.getTempDir(sessionId);
    await fsPromises.mkdir(dir, { recursive: true });

    if (this.redisService) {
      await this.redisService.set(`upload:video:${sessionId}`, meta, 60 * 60 * 24 * 7); // 7 days
    }
    return {
      sessionId,
      chunk_size: meta.chunk_size,
      total_chunks: meta.total_chunks,
      filesize: meta.filesize,
      available_bytes: meta.available_bytes,
    };
  }

  async saveChunkStream(sessionId: string, index: number, req: any) {
    const dir = this.getTempDir(sessionId);
    await fsPromises.mkdir(dir, { recursive: true });

    const chunkPath = path.join(dir, `${index}.chunk`);

    // Stream request body to file
    const writeStream = fs.createWriteStream(chunkPath, { flags: 'w' });
    await pipeline(req, writeStream);

    // update redis
    if (this.redisService) {
      const key = `upload:video:${sessionId}`;
      const meta = (await this.redisService.get<any>(key)) || null;
      if (meta) {
        meta.uploaded_chunks = Array.isArray(meta.uploaded_chunks) ? meta.uploaded_chunks : [];
        if (!meta.uploaded_chunks.includes(index)) meta.uploaded_chunks.push(index);
        meta.updated_at = Date.now();
        await this.redisService.set(key, meta, 60 * 60 * 24 * 7);
      }
    }
  }

  async getUploadStatus(sessionId: string) {
    if (!this.redisService) return { status: 'unknown' };
    const key = `upload:video:${sessionId}`;
    const meta = await this.redisService.get<any>(key);
    if (!meta) return { status: 'not_found' };
    // compute progress
    const uploaded = meta.uploaded_chunks ? meta.uploaded_chunks.length : 0;
    const total = meta.total_chunks || null;
    return {
      sessionId,
      status: meta.status,
      uploaded_chunks: meta.uploaded_chunks || [],
      uploaded_count: uploaded,
      total_chunks: total,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
    };
  }

  async assembleChunks(sessionId: string) {
    const key = `upload:video:${sessionId}`;
    const meta = this.redisService ? await this.redisService.get<any>(key) : null;
    if (!meta) {
      throw new NotFoundException('Upload session not found');
    }

    const dir = this.getTempDir(sessionId);
    const finalDir = this.getFinalDir();
    await fsPromises.mkdir(finalDir, { recursive: true });

    // determine chunk files
    const files = await fsPromises.readdir(dir);
    const chunkFiles = files.filter(f => f.endsWith('.chunk'));
    if (!chunkFiles.length) {
      throw new NotFoundException('No chunks found');
    }

    // sort by numeric index
    chunkFiles.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    const finalFilename = `${sessionId}-${meta.filename}`;
    const finalPath = path.join(finalDir, finalFilename);

    // Append each chunk sequentially to the final file
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(dir, chunkFile);
      const data = await fsPromises.readFile(chunkPath);
      await fsPromises.appendFile(finalPath, data);
    }

    // create Video DB record (site=local, key=finalFilename)
    const movie = await this.movieRepository.findOne({ where: { id: meta.movie_id } });
    const videoEntity = new Video();
    videoEntity.movie = movie as any;
    videoEntity.key = finalFilename;
    videoEntity.site = 'local';
    videoEntity.type = VideoType.MOVIE as any;
    videoEntity.quality = VideoQuality.HD as any;
    videoEntity.official = true;
    await this.videoRepository.save(videoEntity);

    // cleanup chunks
    for (const f of chunkFiles) {
      await fsPromises.unlink(path.join(dir, f));
    }
    // remove temp dir
    await fsPromises.rmdir(dir).catch(() => { });

    // update redis status
    if (this.redisService) {
      meta.status = 'completed';
      meta.final_filename = finalFilename;
      meta.updated_at = Date.now();
      await this.redisService.set(key, meta, 60 * 60 * 24 * 7);
    }

    return videoEntity;
  }

  createVideoStream(videoPath: string, range?: string): StreamResponse {
    // Ensure path is safe and within videos directory
    const safePath = path.normalize(videoPath).replace(/^(\.\.[/\\])+/, '');
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

  async findVideosByMovieId(movieId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { movie: { id: movieId } },
      order: { created_at: 'DESC' },
    });
  }
}
