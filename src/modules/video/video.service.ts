import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoQualityClass } from './video.entity';
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
import ffmpegStatic from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { modelNames } from '@/common/constants/model-name.constant';
import {
  CreateVideoDto,
  InitUploadVideoDto,
  UpdateVideoDto,
  VideoResponseDto,
} from './video.dto';
import { WatchProviderService } from '../watch-provider/services/watch-provider.service';
import { WatchProvider } from '../watch-provider/watch-provider.entity';
import { R2Service } from '../watch-provider/services/r2.service';

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

export interface UploadMeta {
  sessionId: string;
  movie_id: string;
  filename: string;
  duration: number;
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
  title: string;
  type: VideoType;
  progress?: number;
  provider: {
    slug: string;
  };
}

ffmpeg.setFfmpegPath(ffmpegStatic as string);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly redisService: RedisService,
    private readonly providerServ: WatchProviderService,
    private readonly r2Service: R2Service,
  ) { }

  async deleteVideoById(videoId: string): Promise<void> {
    const rawVideo = await this.videoRepository
      .createQueryBuilder('video')
      .select(['video.id', 'video.url'])
      .where('video.id = :id', { id: videoId })
      .leftJoinAndSelect('video.watch_provider', 'watch_provider')
      .getRawOne<{ video_url: string }>();

    if (!rawVideo) {
      throw new NotFoundException('Video không tồn tại');
    }

    // Xoá file trên R2
    const keyPrefix = `videos/${rawVideo.video_url.split('/')[0]}`; // ví dụ: videos/abc123
    await this.r2Service.deleteFolder(keyPrefix);

    // Xoá record trong DB
    await this.videoRepository
      .createQueryBuilder('v')
      .delete()
      .where('video.id = :id', { id: videoId })
      .execute();
  }

  async getVideoById(id: string) {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['movie'],
    });
    if (video) return VideoResponseDto.fromEntity(video);
    return null;
  }

  async findVideosByMovieId(movieId: string): Promise<Video[]> {
    const videos = await this.videoRepository.find({
      where: { movie: { id: movieId } },
      order: { created_at: 'DESC' },
    });

    return videos;
  }

  private getTempDir(sessionId: string) {
    return path.join(process.cwd(), 'uploads', 'tmp', 'videos', sessionId);
  }

  private getFinalDir() {
    return path.join(process.cwd(), 'uploads', 'videos');
  }

  private getThumbnailsDir() {
    return path.join(process.cwd(), 'uploads', 'images');
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

  async createUploadSession(sessionId: string, body: InitUploadVideoDto) {
    const movie = await this.movieRepository.findOne({
      where: { id: body.movie_id },
      select: ['id'],
    });

    if (!movie) {
      throw new NotFoundException('Movie not found.');
    }

    const provider = this.providerServ.getProvider(body.provider.slug);

    if (!provider) {
      throw new NotFoundException('Watch Provider not found.');
    }

    await this.checkPossibleCreatingVideo(body.type, movie, provider);

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
          throw new BadRequestException(
            'Insufficient disk space on server to accept this upload',
          );
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
    if (!body.type) {
      throw new BadRequestException('No type included');
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
      duration: -1,
      title: body.title,
      type: body.type,
      provider: {
        slug: provider.slug,
      },
    };

    const dir = this.getTempDir(sessionId);
    await this.ensureDir(dir);

    if (this.redisService) {
      await this.redisService.set(
        `upload:video:${sessionId}`,
        meta,
        60 * 60 * 24,
      );
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
        await this.redisService.set(key, meta, 60 * 60 * 24);
      }
    }
  }

  async generateThumbnail(
    videoPath: string,
    outputDir: string,
    filename: string,
    publicUrl: string,
  ) {
    await this.ensureDir(outputDir);

    return new Promise<string>((resolve, reject) => {
      ffmpeg(videoPath)
        .on('end', () => resolve(publicUrl))
        .on('error', reject)
        .screenshots({
          count: 1,
          folder: outputDir,
          filename: filename,
          size: '320x180', // thay đổi kích thước tùy nhu cầu
        });
    });
  }

  private async getVideoMetadata(
    filePath: string,
  ): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          return reject(err);
        }

        const stream = metadata.streams.find((s) => s.codec_type === 'video');
        const duration = metadata.format.duration || 0;
        const width = stream?.width || 0;
        const height = stream?.height || 0;

        resolve({ duration, width, height });
      });
    });
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
      progress: meta.progress,
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
    await this.redisService.set(key, meta, 60 * 60 * 24);

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
      meta.progress = 0;
      await this.redisService.set(key, meta, 60 * 60 * 24);

      // 2️⃣ Save videos to database
      const insertResult = await this.saveVideosToDatabase(meta, videoKey);
      const videoId = insertResult.identifiers[0].id;

      const thumbnailDir = this.getThumbnailsDir();
      const thumbnailFilename = `${videoId}-thumbnail-${Date.now()}.jpg`;
      const thumbnailPath = '/image/get/' + thumbnailFilename;

      await this.generateThumbnail(
        tempMp4,
        thumbnailDir,
        thumbnailFilename,
        thumbnailPath,
      );
      const { duration, height, width } = await this.getVideoMetadata(tempMp4);
      await this.updateVideo({ id: videoId, thumbnail: thumbnailPath });

      const continueToHLS = async () => {
        // 3️⃣ Convert to HLS with multiple qualities
        await this.convertToHLS(tempMp4, videoDir, key, meta);

        // 4️⃣ Create master playlist and thumbnail
        await this.createMasterPlaylist(videoDir);

        meta.duration = duration;

        // 5️⃣ Delete original MP4
        await this.deleteFileSafe(tempMp4);

        // 6️⃣ Update status to COMPLETED
        meta.status = UploadStatus.COMPLETED;
        meta.updated_at = Date.now();
        meta.final_filename = meta.filename;
        meta.hls_path = `${videoKey}/master.m3u8`;
        meta.size = size;
        await this.redisService.set(key, meta, 60 * 60 * 24);

        const provider = meta.provider;
        if (provider.slug === 'r2') {
          const remotePrefix = `videos/${meta.type}/${videoId}`;
          await this.r2Service.uploadDirectory(videoDir, remotePrefix);
          await this.updateVideo({
            id: videoId,
            url: `${meta.type}/${videoId}/master.m3u8`,
          });
          await this.removeAllFiles(videoDir);
          // Cập nhật lại đường dẫn HLS public URL
          meta.hls_path = `${remotePrefix}/master.m3u8`;
          meta.status = UploadStatus.COMPLETED;
          meta.updated_at = Date.now();
          await this.redisService.set(key, meta, 60 * 60 * 24);

          console.log(`🎉 Uploaded HLS to R2: ${meta.hls_path}`);
        }

        // Tiếp tục cleanup
        await this.cleanupTempChunks(dir);
      };

      continueToHLS();

      return { sessionId, video_id: insertResult.identifiers[0].id };
    } catch (error) {
      console.error('[assembleChunks] Error:', error);

      meta.status = UploadStatus.FAILED;
      meta.error = error.message;
      meta.updated_at = Date.now();
      await this.redisService.set(key, meta, 60 * 60 * 24);

      throw error;
    }
  }

  private async assembleChunksToMp4(
    dir: string,
    outputPath: string,
    meta: UploadMeta,
  ) {
    const files = await fsPromises.readdir(dir);
    const chunkFiles = files
      .filter((f) => f.endsWith('.chunk'))
      .map((f) => parseInt(f.replace('.chunk', ''), 10))
      .sort((a, b) => a - b);

    if (meta.total_chunks && chunkFiles.length !== meta.total_chunks) {
      throw new Error(
        `Expected ${meta.total_chunks} chunks but found ${chunkFiles.length}`,
      );
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

  private async convertToHLS(
    inputPath: string,
    outputDir: string,
    key: string,
    meta: UploadMeta,
  ): Promise<void> {
    const qualities = [
      { quality: VideoQuality.HD, height: 1080, folder: '1080', bitrate: 5000 },
      {
        quality: VideoQuality.MEDIUM,
        height: 720,
        folder: '720',
        bitrate: 3000,
      },
      { quality: VideoQuality.LOW, height: 480, folder: '480', bitrate: 1500 },
    ];
    let index = 1;
    for (const q of qualities) {
      const hlsDir = path.join(outputDir, q.folder);
      await this.ensureDir(hlsDir);
      const outputPath = path.join(hlsDir, 'index.m3u8');

      console.log(`[HLS] Processing ${q.quality} (${q.height}p)...`);
      let lastUpdate = 0;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            `-vf scale=-2:${q.height}`,
            '-c:a aac',
            '-ar 48000',
            '-b:a 128k',
            '-c:v h264',
            `-b:v ${q.bitrate}k`,
            '-hls_time 10',
            '-hls_list_size 0',
            `-hls_segment_filename ${path.join(hlsDir, 'segment%03d.ts')}`,
          ])
          .output(outputPath)
          .on('start', (cmd) => console.log(`[FFmpeg] Start: ${cmd}`))
          .on('progress', (progress) => {
            if (!progress.percent) return;

            const totalProgress = progress.percent / 300 + (index - 1) / 3;
            const now = Date.now();

            if (now - lastUpdate > 5000) {
              // chỉ update mỗi 1s
              lastUpdate = now;

              process.nextTick(async () => {
                try {
                  await this.redisService.set(
                    key,
                    { ...meta, progress: Math.round(totalProgress * 100) },
                    60 * 60 * 24,
                  );
                } catch (err) {
                  console.error('[Redis] update failed:', err);
                }
              });
            }

            process.stdout.write(
              `\r[${q.quality}] ${progress.percent.toFixed(1)}% done, ${lastUpdate}`,
            );
          })
          .on('end', () => {
            console.log(`\n[HLS] ✓ Completed ${q.quality}`);
            index += 1;
            resolve();
          })
          .on('error', (err) => {
            console.error(`[HLS] ✗ Failed ${q.quality}:`, err.message);
            reject(new Error(`FFmpeg failed for ${q.quality}: ${err.message}`));
          })
          .run();
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error(`HLS output not created for ${q.quality}`);
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

  private async saveVideosToDatabase(meta: UploadMeta, videoKey: string) {
    const movie = await this.movieRepository.findOne({
      where: { id: meta.movie_id },
    });
    if (!movie) {
      throw new NotFoundException(`Movie ${meta.movie_id} not found`);
    }

    const qualities = [
      { quality: VideoQuality.HD, folder: '1080' },
      { quality: VideoQuality.MEDIUM, folder: '720' },
      { quality: VideoQuality.LOW, folder: '480' },
    ];

    const qualities_urls: VideoQualityClass[] = [];

    for (const q of qualities) {
      qualities_urls.push({
        quality: q.quality,
        url: `${videoKey}/${q.folder}/index.m3u8`,
      });
    }
    const provider = this.providerServ.getProvider(meta.provider.slug);
    if (!provider) {
      throw new Error('Watch provider "local" not found');
    }

    return this.createVideo({
      movie,
      name: meta.title ?? meta.filename ?? 'Untitled',
      url: `${meta.type}/${videoKey}/master.m3u8`,
      site: provider.slug,
      type: meta.type,
      qualities: qualities_urls,
      official: true,
      watch_provider: provider,
    });
  }

  private async checkPossibleCreatingVideo(
    type: VideoType,
    movie: string | Movie,
    watch_provider: string | WatchProvider,
  ) {
    if (type === VideoType.MOVIE) {
      const exists = await this.videoRepository.findOne({
        where: {
          movie: typeof movie === 'string' ? { id: movie } : { id: movie.id },
          watch_provider:
            typeof watch_provider === 'string'
              ? { id: watch_provider }
              : { id: watch_provider.id },
          type: VideoType.MOVIE,
        },
        relations: ['movie', 'watch_provider'],
      });

      if (exists) {
        throw new BadRequestException(
          `Movie already has a main (MOVIE) video on provider "${exists.watch_provider.name}".`,
        );
      }
    }
  }

  async createVideo(data: CreateVideoDto) {
    const {
      watch_provider,
      movie,
      name,
      url,
      site,
      type,
      qualities,
      official,
    } = data;

    await this.checkPossibleCreatingVideo(type, movie, watch_provider);

    const video = this.videoRepository.create({
      watch_provider:
        typeof watch_provider === 'string'
          ? { id: watch_provider }
          : { id: watch_provider.id },
      movie: typeof movie === 'string' ? { id: movie } : { id: movie.id },
      name,
      url,
      site,
      type,
      qualities,
      official,
    });
    return await this.videoRepository
      .createQueryBuilder()
      .insert()
      .into(modelNames.VIDEO)
      .values(video)
      .execute();
  }

  async updateVideo(data: UpdateVideoDto) {
    const { id, movie, watch_provider, ...updateData } = data;

    // 1. Tìm video cần cập nhật
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['movie', 'watch_provider'],
    });

    if (!video) {
      throw new NotFoundException('Video không tồn tại');
    }

    // 2. Chuẩn hóa lại dữ liệu liên kết (movie, provider)
    if (movie) {
      video.movie = typeof movie === 'string' ? ({ id: movie } as any) : movie;
    }

    if (watch_provider) {
      video.watch_provider =
        typeof watch_provider === 'string'
          ? ({ id: watch_provider } as any)
          : watch_provider;
    }

    // 3. Gán các field có trong DTO (những field khác sẽ được giữ nguyên)
    Object.assign(video, updateData);

    // 4. Lưu lại thay đổi
    return await this.videoRepository
      .createQueryBuilder()
      .update()
      .where('id = :id', { id })
      .set(updateData)
      .execute();
  }

  private async cleanupTempChunks(dir: string) {
    await this.removeAllFiles(dir);
  }

  private async removeAllFiles(dir: string) {
    try {
      await fsPromises.rm(dir, { recursive: true, force: true });
      console.log(`Đã xoá toàn bộ thư mục tạm: ${dir}`);
    } catch (error: any) {
      console.warn(`Không thể xoá thư mục tạm ${dir}:`, error.message);
    }
  }

  createVideoStream(videoPath: string, range?: string): StreamResponse {
    const safePath = path.normalize(videoPath).replace(/^(\.\.[/\\])+/, '');
    const videoFilePath = path.join(this.getFinalDir(), safePath);
    console.log(videoFilePath);

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
}
