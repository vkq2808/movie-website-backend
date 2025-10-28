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
import { execSync, exec } from 'child_process';
import { RedisService } from '@/modules/redis/redis.service';
import { VideoType, VideoQuality } from '@/common/enums';
const pipeline = promisify(stream.pipeline);
const execAsync = promisify(exec);

interface StreamResponse {
  stream: fs.ReadStream;
  contentLength: number;
  headers: {
    statusCode: number;
    contentRange?: string;
    contentType: string;
    cacheControl?: string;
  };
}

export enum UploadStatus {
  IN_PROGRESS = 'in_progress',
  ASSEMBLING = 'assembling',
  CONVERTING = 'converting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

interface UploadMeta {
  sessionId: string;
  movie_id: string;
  filename: string;
  total_chunks: number | null;
  filesize: number | null;
  chunk_size: number;
  uploaded_chunks: number[];
  created_at: number;
  updated_at: number;
  status: UploadStatus;
  available_bytes: number | null;
  video_key?: string;
  error?: string;
  final_filename?: string;
  hls_path?: string;
  size?: number;
}

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly redisService: RedisService,
  ) { }

  private getTempDir(sessionId: string) {
    return path.join(process.cwd(), 'uploads', 'tmp', 'videos', sessionId);
  }

  private getFinalDir() {
    return path.join(process.cwd(), 'uploads', 'videos');
  }

  private async ensureDir(dir: string) {
    await fsPromises.mkdir(dir, { recursive: true });
  }

  private async deleteFileSafe(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        await fsPromises.unlink(filePath);
      }
    } catch (error) {
      console.warn(`Failed to delete file ${filePath}:`, error.message);
    }
  }

  async createUploadSession(
    sessionId: string,
    body: { movie_id: string; filename: string; total_chunks?: number; filesize?: number },
  ) {
    const finalDir = this.getFinalDir();
    const reserveBytes = 100 * 1024 * 1024; // 100MB reserve

    let availableBytes: number | null = null;
    if (body.filesize && body.filesize > 0) {
      try {
        const stdout = execSync(`df -k "${finalDir}"`).toString();
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          const cols = lines[1].trim().split(/\s+/);
          const availKb = parseInt(cols[3], 10);
          availableBytes = availKb * 1024;
        }
      } catch (e) {
        // ignore df errors
      }

      if (availableBytes !== null) {
        const required = body.filesize + reserveBytes;
        if (availableBytes < required) {
          throw new BadRequestException('Insufficient disk space on server to accept this upload');
        }
      }
    }

    const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    let chunk_size = DEFAULT_CHUNK_SIZE;
    let total_chunks = body.total_chunks || null;

    if (body.filesize && body.filesize > 0) {
      total_chunks = Math.ceil(body.filesize / chunk_size);
      if (total_chunks > 1000) {
        chunk_size = Math.ceil(body.filesize / 500);
        total_chunks = Math.ceil(body.filesize / chunk_size);
      }
    }

    const meta: UploadMeta = {
      sessionId,
      movie_id: body.movie_id,
      filename: body.filename,
      total_chunks,
      filesize: body.filesize || null,
      chunk_size,
      uploaded_chunks: [],
      created_at: Date.now(),
      updated_at: Date.now(),
      status: UploadStatus.IN_PROGRESS,
      available_bytes: availableBytes,
      video_key: sessionId,
    };

    const dir = this.getTempDir(sessionId);
    await this.ensureDir(dir);

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
    await this.ensureDir(dir);

    const chunkPath = path.join(dir, `${index}.chunk`);
    const writeStream = fs.createWriteStream(chunkPath, { flags: 'w' });
    await pipeline(req, writeStream);

    if (this.redisService) {
      const key = `upload:video:${sessionId}`;
      const meta = await this.redisService.get<UploadMeta>(key);

      if (meta) {
        if (!meta.uploaded_chunks.includes(index)) {
          meta.uploaded_chunks.push(index);
        }
        meta.updated_at = Date.now();
        await this.redisService.set(key, meta, 60 * 60 * 24 * 7);
      }
    }
  }

  async getUploadStatus(sessionId: string) {
    if (!this.redisService) return { status: 'unknown' };

    const key = `upload:video:${sessionId}`;
    const meta = await this.redisService.get<UploadMeta>(key);

    if (!meta) return { status: 'not_found' };

    const uploaded = meta.uploaded_chunks.length;
    const total = meta.total_chunks || null;

    return {
      sessionId,
      status: meta.status,
      uploaded_chunks: meta.uploaded_chunks,
      uploaded_count: uploaded,
      total_chunks: total,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      video_key: meta.video_key,
    };
  }

  async assembleChunks(sessionId: string) {
    const key = `upload:video:${sessionId}`;
    const meta = await this.redisService.get<UploadMeta>(key);

    if (!meta) {
      throw new NotFoundException(`Upload session ${sessionId} not found`);
    }

    // Update status to ASSEMBLING
    meta.status = UploadStatus.ASSEMBLING;
    meta.updated_at = Date.now();
    await this.redisService.set(key, meta, 60 * 60 * 24 * 7);

    const dir = this.getTempDir(sessionId);
    const finalDir = this.getFinalDir();
    await this.ensureDir(finalDir);

    const videoKey = meta.video_key || sessionId;
    const videoDir = path.join(finalDir, videoKey);
    await this.ensureDir(videoDir);

    const tempMp4 = path.join(videoDir, 'original.mp4');

    try {
      // 1️⃣ Assemble chunks to MP4
      await this.assembleChunksToMp4(dir, tempMp4, meta);

      if (!fs.existsSync(tempMp4)) {
        throw new Error(`Failed to assemble chunks to ${tempMp4}`);
      }

      const { size } = fs.statSync(tempMp4);

      // Update status to CONVERTING
      meta.status = UploadStatus.CONVERTING;
      meta.updated_at = Date.now();
      await this.redisService.set(key, meta, 60 * 60 * 24 * 7);

      // 2️⃣ Convert to HLS with multiple qualities
      await this.convertToHLS(tempMp4, videoDir);

      // 3️⃣ Create master playlist
      await this.createMasterPlaylist(videoDir);

      // 4️⃣ Delete original MP4
      await this.deleteFileSafe(tempMp4);

      // 5️⃣ Save videos to database
      const savedVideos = await this.saveVideosToDatabase(meta, videoKey, size);

      // 6️⃣ Update status to COMPLETED
      meta.status = UploadStatus.COMPLETED;
      meta.updated_at = Date.now();
      meta.final_filename = meta.filename;
      meta.hls_path = `${videoKey}/master.m3u8`;
      meta.size = size;
      await this.redisService.set(key, meta, 60 * 60 * 24 * 7);

      // 7️⃣ Cleanup temp chunks
      await this.cleanupTempChunks(dir);

      return savedVideos;
    } catch (error) {
      console.error('[assembleChunks] Error:', error);

      meta.status = UploadStatus.FAILED;
      meta.error = error.message;
      meta.updated_at = Date.now();
      await this.redisService.set(key, meta, 60 * 60 * 24 * 7);

      throw error;
    }
  }

  private async assembleChunksToMp4(dir: string, outputPath: string, meta: UploadMeta) {
    const files = await fsPromises.readdir(dir);
    const chunkFiles = files
      .filter((f) => f.endsWith('.chunk'))
      .map((f) => parseInt(f.replace('.chunk', ''), 10))
      .sort((a, b) => a - b);

    if (meta.total_chunks && chunkFiles.length !== meta.total_chunks) {
      throw new Error(`Expected ${meta.total_chunks} chunks but found ${chunkFiles.length}`);
    }

    const writeStream = fs.createWriteStream(outputPath);

    for (const idx of chunkFiles) {
      const chunkPath = path.join(dir, `${idx}.chunk`);
      const readStream = fs.createReadStream(chunkPath);
      await pipeline(readStream, writeStream, { end: false });
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    });
  }

  private async convertToHLS(inputPath: string, outputDir: string) {
    const qualities = [
      { quality: VideoQuality.HD, height: 1080, folder: '1080', bitrate: 5000 },
      { quality: VideoQuality.MEDIUM, height: 720, folder: '720', bitrate: 3000 },
      { quality: VideoQuality.LOW, height: 480, folder: '480', bitrate: 1500 },
    ];

    for (const q of qualities) {
      const hlsDir = path.join(outputDir, q.folder);
      await this.ensureDir(hlsDir);

      const outputPath = path.join(hlsDir, 'index.m3u8');

      const cmd = [
        'ffmpeg',
        '-i', `"${inputPath}"`,
        '-vf', `scale=-2:${q.height}`,
        '-c:a', 'aac',
        '-ar', '48000',
        '-b:a', '128k',
        '-c:v', 'h264',
        '-b:v', `${q.bitrate}k`,
        '-hls_time', '10',
        '-hls_list_size', '0',
        '-hls_segment_filename', `"${path.join(hlsDir, 'segment%03d.ts')}"`,
        '-f', 'hls',
        `"${outputPath}"`
      ].join(' ');

      console.log(`[HLS] Processing ${q.quality} (${q.height}p)...`);

      try {
        await execAsync(cmd);

        if (!fs.existsSync(outputPath)) {
          throw new Error(`HLS output not created for ${q.quality}`);
        }

        console.log(`[HLS] ✓ Completed ${q.quality}`);
      } catch (error) {
        console.error(`[HLS] ✗ Failed ${q.quality}:`, error.message);
        throw new Error(`FFmpeg failed for quality ${q.quality}: ${error.message}`);
      }
    }
  }

  private async createMasterPlaylist(videoDir: string) {
    const masterPlaylist = path.join(videoDir, 'master.m3u8');
    const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480/index.m3u8
`;
    await fsPromises.writeFile(masterPlaylist, masterContent);
  }

  private async saveVideosToDatabase(meta: UploadMeta, videoKey: string, size: number) {
    const movie = await this.movieRepository.findOne({ where: { id: meta.movie_id } });
    if (!movie) {
      throw new NotFoundException(`Movie ${meta.movie_id} not found`);
    }

    const savedVideos: Video[] = [];

    const qualities = [
      { quality: VideoQuality.HD, folder: '1080' },
      { quality: VideoQuality.MEDIUM, folder: '720' },
      { quality: VideoQuality.LOW, folder: '480' },
    ];

    for (const q of qualities) {
      const videoEntity = this.videoRepository.create({
        movie,
        name: meta.filename ?? 'Untitled',
        key: `${videoKey}/${q.folder}/index.m3u8`,
        site: 'local',
        size,
        type: VideoType.MOVIE,
        quality: q.quality,
        official: true,
      });
      await this.videoRepository.save(videoEntity);
      savedVideos.push(videoEntity);
    }

    const masterEntity = this.videoRepository.create({
      movie,
      name: meta.filename ?? 'Untitled',
      key: `${videoKey}/master.m3u8`,
      site: 'local',
      size,
      type: VideoType.MOVIE,
      quality: VideoQuality.HD,
      official: true,
    });
    await this.videoRepository.save(masterEntity);
    savedVideos.push(masterEntity);

    return savedVideos;
  }

  private async cleanupTempChunks(dir: string) {
    try {
      const chunkFiles = await fsPromises.readdir(dir);
      for (const f of chunkFiles) {
        await fsPromises.unlink(path.join(dir, f));
      }
      await fsPromises.rmdir(dir);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${dir}:`, error.message);
    }
  }

  createVideoStream(videoPath: string, range?: string): StreamResponse {
    const safePath = path.normalize(videoPath).replace(/^(\.\.[/\\])+/, '');
    const videoFilePath = path.join(this.getFinalDir(), safePath);

    if (!fs.existsSync(videoFilePath)) {
      throw new NotFoundException('Video not found');
    }

    // Handle HLS playlist
    if (videoFilePath.endsWith('.m3u8')) {
      const playlistContent = fs.readFileSync(videoFilePath);
      return {
        stream: fs.createReadStream(videoFilePath),
        contentLength: playlistContent.length,
        headers: {
          statusCode: 200,
          contentType: 'application/vnd.apple.mpegurl',
          cacheControl: 'no-cache',
        },
      };
    }

    // Handle HLS segments
    if (videoFilePath.endsWith('.ts') || videoFilePath.endsWith('.m2ts')) {
      const stat = fs.statSync(videoFilePath);
      const stream = fs.createReadStream(videoFilePath);
      return {
        stream,
        contentLength: stat.size,
        headers: {
          statusCode: 200,
          contentType: 'video/MP2T',
          cacheControl: 'public, max-age=31536000',
        },
      };
    }

    // Fallback: Progressive MP4 streaming
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
          contentType: 'video/mp4',
        },
      };
    }

    const stream = fs.createReadStream(videoFilePath);
    return {
      stream,
      contentLength: videoSize,
      headers: {
        statusCode: 200,
        contentType: 'video/mp4',
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