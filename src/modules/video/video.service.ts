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
import { MovieViewLog } from './entities/movie-view-log.entity';
import { User } from '../user/user.entity';

interface HLSConfig {
  segmentDuration: number;
  enableProgramDateTime: boolean;
  slidingWindowDuration: number; // Thời gian rewind cho live (giây)
}

interface SegmentInfo {
  duration: number;
  file: string;
  timestamp?: number;
}

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
    @InjectRepository(MovieViewLog)
    private readonly movieViewLogRepository: Repository<MovieViewLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
    private readonly providerServ: WatchProviderService,
    private readonly r2Service: R2Service,
  ) {}

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
      await fsPromises.unlink(filePath);
    } catch (error: any) {
      console.warn(`Could not delete file ${filePath}:`, error.message);
    }
  }

  async initUploadVideo(body: InitUploadVideoDto, sessionId: string) {
    const movie = await this.movieRepository.findOne({
      where: { id: body.movie_id },
    });
    if (!movie) {
      throw new NotFoundException(`Movie ${body.movie_id} not found`);
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

  /**
   * FEATURE: View Count Tracking (ISSUE-09 / Bonus Task)
   *
   * Track movie views to prevent double counting
   * Logic: Only increment view count once per user per 30-minute window
   *
   * Business Rules:
   * - View is counted when user successfully starts streaming MOVIE type
   * - Only one view per user per movie per 30 minutes
   * - No double counting on page refresh
   */
  async trackMovieView(userId: string, movieId: string): Promise<boolean> {
    try {
      // Redis-based deduplication (faster and simpler than DB queries)
      const cacheKey = `movie:view:${movieId}:user:${userId}`;

      // Check if this user already viewed this movie in the window
      const existingView = await this.redisService.get(cacheKey);
      if (existingView) {
        // Already counted in this window - prevent double count
        return false;
      }

      // Get user and movie
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      const movie = await this.movieRepository.findOne({
        where: { id: movieId },
      });

      if (!user || !movie) {
        return false;
      }

      // Create view log entry for audit trail
      const viewLog = this.movieViewLogRepository.create({
        user,
        movie,
      });
      await this.movieViewLogRepository.save(viewLog);

      // Increment view count
      movie.view_count = (movie.view_count || 0) + 1;
      await this.movieRepository.save(movie);

      // Set Redis cache to prevent double counting
      // TTL: 30 minutes (1800 seconds)
      await this.redisService.set(cacheKey, '1', 1800);

      return true;
    } catch (error) {
      // Log error but don't fail the stream operation
      console.error('[trackMovieView] Error:', error);
      return false;
    }
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
        // Convert to HLS with multiple qualities
        await this.convertToHLS(tempMp4, videoDir, key, meta);

        meta.duration = duration;

        // Delete original MP4
        await this.deleteFileSafe(tempMp4);

        // Update status to COMPLETED
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
    hlsConfig: HLSConfig = {
      segmentDuration: 6,
      enableProgramDateTime: true,
      slidingWindowDuration: 120, // 2 phút
    },
  ): Promise<void> {
    const qualities = [
      {
        quality: VideoQuality.HD,
        height: 1080,
        folder: '1080',
        bitrate: 5000,
        bandwidth: 5000000,
      },
      {
        quality: VideoQuality.MEDIUM,
        height: 720,
        folder: '720',
        bitrate: 3000,
        bandwidth: 3000000,
      },
      {
        quality: VideoQuality.LOW,
        height: 480,
        folder: '480',
        bitrate: 1500,
        bandwidth: 1500000,
      },
    ];

    let index = 1;
    const videoStartTime = new Date(); // Thời điểm bắt đầu video

    for (const q of qualities) {
      const hlsDir = path.join(outputDir, q.folder);
      await this.ensureDir(hlsDir);

      console.log(`[HLS] Processing ${q.quality} (${q.height}p)...`);
      const lastUpdate = 0;

      // Tạo segments với FFmpeg
      await this.generateHLSSegments(
        inputPath,
        hlsDir,
        q,
        hlsConfig,
        key,
        meta,
        index,
        lastUpdate,
      );

      // Tạo cả 2 playlist: VOD (index.m3u8) và LIVE (live.m3u8)
      await this.createVODPlaylist(hlsDir, hlsConfig, videoStartTime);
      await this.createLivePlaylist(hlsDir, hlsConfig, videoStartTime);

      console.log(`[HLS] ✓ Created VOD & LIVE playlists for ${q.quality}`);
      index += 1;
    }

    // Tạo master playlist
    await this.createMasterPlaylist(outputDir, qualities);
  }

  private async generateHLSSegments(
    inputPath: string,
    hlsDir: string,
    quality: any,
    hlsConfig: HLSConfig,
    key: string,
    meta: UploadMeta,
    index: number,
    lastUpdate: number,
  ): Promise<void> {
    // Tạo playlist tạm để FFmpeg generate
    const tempPlaylist = path.join(hlsDir, 'temp.m3u8');
    const segmentPattern = path.join(hlsDir, 'segment%05d.ts');

    const ffmpegOptions = [
      `-vf scale=-2:${quality.height}`,
      '-c:a aac',
      '-ar 48000',
      '-b:a 128k',
      '-c:v h264',
      `-b:v ${quality.bitrate}k`,
      '-profile:v main',
      '-level 4.0',
      '-sc_threshold 0', // Tắt scene detection để segment đều
      '-g 48', // GOP size
      '-keyint_min 48',
      '-force_key_frames expr:gte(t,n_forced*6)', // Force keyframe mỗi 6s
      `-hls_time ${hlsConfig.segmentDuration}`,
      '-hls_list_size 0',
      `-hls_segment_filename ${segmentPattern}`,
      '-hls_flags independent_segments+program_date_time',
      '-hls_segment_type mpegts',
    ];

    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(ffmpegOptions)
        .output(tempPlaylist)
        .on('start', (cmd) => console.log(`[FFmpeg] Start: ${cmd}`))
        .on('progress', (progress) => {
          if (!progress.percent) return;

          const totalProgress = progress.percent / 300 + (index - 1) / 3;
          const now = Date.now();

          if (now - lastUpdate > 5000) {
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
            `\r[${quality.quality}] ${progress.percent.toFixed(1)}% done`,
          );
        })
        .on('end', async () => {
          console.log(`\n[HLS] ✓ Completed ${quality.quality}`);
          // Xóa temp playlist
          try {
            await fsPromises.unlink(tempPlaylist);
          } catch (e) {}
          resolve();
        })
        .on('error', (err) => {
          console.error(`[HLS] ✗ Failed ${quality.quality}:`, err.message);
          reject(
            new Error(`FFmpeg failed for ${quality.quality}: ${err.message}`),
          );
        })
        .run();
    });
  }

  private async createVODPlaylist(
    hlsDir: string,
    hlsConfig: HLSConfig,
    videoStartTime: Date,
  ): Promise<void> {
    const segments = await this.getSegmentsInfo(hlsDir);
    const outputPath = path.join(hlsDir, 'index.m3u8');

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-PLAYLIST-TYPE:VOD');

    // Target duration = segment lớn nhất + 1
    const maxDuration = Math.max(...segments.map((s) => s.duration));
    const targetDuration = Math.ceil(maxDuration) + 1;
    lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
    lines.push('#EXT-X-MEDIA-SEQUENCE:0');

    // Program Date Time cho segment đầu tiên
    if (hlsConfig.enableProgramDateTime) {
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${videoStartTime.toISOString()}`);
    }

    // Thêm tất cả segments
    for (const segment of segments) {
      lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      lines.push(segment.file);
    }

    lines.push('#EXT-X-ENDLIST');

    await fsPromises.writeFile(outputPath, lines.join('\n') + '\n');
    console.log(`[HLS] Created VOD playlist: ${outputPath}`);
  }

  private async createLivePlaylist(
    hlsDir: string,
    hlsConfig: HLSConfig,
    videoStartTime: Date,
  ): Promise<void> {
    const segments = await this.getSegmentsInfo(hlsDir);
    const outputPath = path.join(hlsDir, 'live.m3u8');

    // Tính sliding window size dựa trên thời gian rewind
    const slidingWindowSize = Math.ceil(
      hlsConfig.slidingWindowDuration / hlsConfig.segmentDuration,
    );

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-PLAYLIST-TYPE:EVENT'); // EVENT: giữ tất cả segments, mở rộng dần

    const maxDuration = Math.max(...segments.map((s) => s.duration));
    const targetDuration = Math.ceil(maxDuration) + 1;
    lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
    lines.push('#EXT-X-MEDIA-SEQUENCE:0');

    // Program Date Time cho segment đầu tiên
    if (hlsConfig.enableProgramDateTime) {
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${videoStartTime.toISOString()}`);
    }

    // Metadata để client biết cách xử lý live simulation
    lines.push(
      `#EXT-X-CUSTOM-START-TIME:${Math.floor(videoStartTime.getTime() / 1000)}`,
    );
    lines.push(`#EXT-X-CUSTOM-SEGMENT-DURATION:${hlsConfig.segmentDuration}`);
    lines.push(
      `#EXT-X-CUSTOM-REWIND-DURATION:${hlsConfig.slidingWindowDuration}`,
    );

    // Thêm tất cả segments (EVENT type giữ tất cả)
    for (const segment of segments) {
      lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      lines.push(segment.file);
    }

    // Không có #EXT-X-ENDLIST để cho biết có thể mở rộng (dù static)

    await fsPromises.writeFile(outputPath, lines.join('\n') + '\n');
    console.log(`[HLS] Created LIVE playlist: ${outputPath}`);
  }

  private async getSegmentsInfo(hlsDir: string): Promise<SegmentInfo[]> {
    const files = await fsPromises.readdir(hlsDir);
    const segmentFiles = files
      .filter((f) => f.startsWith('segment') && f.endsWith('.ts'))
      .sort();

    const segments: SegmentInfo[] = [];

    // Đọc duration từ ffprobe
    for (const file of segmentFiles) {
      const filePath = path.join(hlsDir, file);
      const duration = await this.getSegmentDuration(filePath);

      segments.push({
        duration: duration,
        file: file,
      });
    }

    return segments;
  }

  private async getSegmentDuration(segmentPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(segmentPath, (err, metadata) => {
        if (err) {
          console.error(`[FFprobe] Error reading ${segmentPath}:`, err);
          resolve(6.0); // Fallback duration
          return;
        }

        const duration = metadata.format.duration || 6.0;
        resolve(duration);
      });
    });
  }

  private async createMasterPlaylist(
    videoDir: string,
    qualities: any[],
  ): Promise<void> {
    const masterPlaylist = path.join(videoDir, 'master.m3u8');

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-INDEPENDENT-SEGMENTS');
    lines.push('');
    lines.push('# VOD Playlists');

    // Thêm VOD variants
    for (const q of qualities) {
      const resolution =
        q.height === 1080
          ? '1920x1080'
          : q.height === 720
            ? '1280x720'
            : '854x480';
      const codecs = 'avc1.640028,mp4a.40.2';

      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${resolution},CODECS="${codecs}",NAME="${q.quality}"`,
      );
      lines.push(`${q.folder}/index.m3u8`);
    }

    lines.push('');
    lines.push('# LIVE Playlists (for simulated livestream)');

    // Thêm LIVE variants
    for (const q of qualities) {
      const resolution =
        q.height === 1080
          ? '1920x1080'
          : q.height === 720
            ? '1280x720'
            : '854x480';
      const codecs = 'avc1.640028,mp4a.40.2';

      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${resolution},CODECS="${codecs}",NAME="${q.quality}-live"`,
      );
      lines.push(`${q.folder}/live.m3u8`);
    }

    await fsPromises.writeFile(masterPlaylist, lines.join('\n') + '\n');
    console.log(`[HLS] Created master playlist: ${masterPlaylist}`);
  }

  // ===== HELPER: Tạo dynamic live playlist (nếu cần update realtime) =====
  // Hàm này để update live.m3u8 theo thời gian thực nếu bạn muốn
  // sliding window thực sự (xóa segment cũ)
  private async updateDynamicLivePlaylist(
    hlsDir: string,
    currentTime: Date,
    videoStartTime: Date,
    hlsConfig: HLSConfig,
  ): Promise<void> {
    const segments = await this.getSegmentsInfo(hlsDir);
    const outputPath = path.join(hlsDir, 'live.m3u8');

    // Tính elapsed time từ khi video bắt đầu
    const elapsedSeconds =
      (currentTime.getTime() - videoStartTime.getTime()) / 1000;

    // Tính segment hiện tại đang "phát"
    const currentSegmentIndex = Math.floor(
      elapsedSeconds / hlsConfig.segmentDuration,
    );

    // Sliding window: chỉ giữ các segment trong khoảng rewind
    const windowSize = Math.ceil(
      hlsConfig.slidingWindowDuration / hlsConfig.segmentDuration,
    );
    const startIndex = Math.max(0, currentSegmentIndex - windowSize);
    const endIndex = Math.min(segments.length, currentSegmentIndex + 1);

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-PLAYLIST-TYPE:LIVE'); // LIVE type cho sliding window

    const maxDuration = Math.max(...segments.map((s) => s.duration));
    const targetDuration = Math.ceil(maxDuration) + 1;
    lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
    lines.push(`#EXT-X-MEDIA-SEQUENCE:${startIndex}`);

    // Program Date Time cho segment đầu trong window
    if (hlsConfig.enableProgramDateTime && startIndex < segments.length) {
      const segmentTime = new Date(
        videoStartTime.getTime() +
          startIndex * hlsConfig.segmentDuration * 1000,
      );
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${segmentTime.toISOString()}`);
    }

    // Thêm segments trong sliding window
    for (let i = startIndex; i < endIndex; i++) {
      if (i < segments.length) {
        const segment = segments[i];
        lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
        lines.push(segment.file);
      }
    }

    // Không có ENDLIST

    await fsPromises.writeFile(outputPath, lines.join('\n') + '\n');
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
