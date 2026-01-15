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
import { FileStabilityChecker } from './utils/file-stability.util';
import { SafeFFprobe } from './utils/safe-ffprobe.util';
import { HLSPlaylistParser } from './utils/hls-playlist.parser';
import { HLSStateManager, HLSProcessingState } from './utils/hls-state.manager';
import { SafePlaylistOperations } from './utils/safe-playlist.operations';
import { FallbackPlaylistGenerator } from './utils/fallback-playlist.generator';
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
import { WatchHistoryService } from '../watch-history/watch-history.service';

interface HLSConfig {
  segmentDuration: number;
  enableProgramDateTime: boolean;
  slidingWindowDuration: number;
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
    private readonly watchHistoryService: WatchHistoryService,
  ) {}

  async deleteVideoById(videoId: string): Promise<void> {
    const rawVideo = await this.videoRepository
      .createQueryBuilder('video')
      .select(['video.id', 'video.url'])
      .where('video.id = :id', { id: videoId })
      .leftJoinAndSelect('video.watch_provider', 'watch_provider')
      .getRawOne<{ video_url: string }>();

    if (!rawVideo) {
      throw new NotFoundException('Video does not exist');
    }

    const keyPrefix = `videos/${rawVideo.video_url.split('/')[0]}`;
    await this.r2Service.deleteFolder(keyPrefix);

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
    console.log('test');
    if (!movie) {
      console.log(`Movie not found`);
      throw new NotFoundException(`Movie ${body.movie_id} not found`);
    }

    const provider = this.providerServ.getProvider(body.provider.slug);
    console.log('test2');
    if (!provider) {
      console.log(`Watch Provider not found.`);
      throw new NotFoundException('Watch Provider not found.');
    }

    await this.checkPossibleCreatingVideo(body.type, movie, provider);
    console.log('test3');

    const finalDir = this.getFinalDir();
    const reserveBytes = 100 * 1024 * 1024;
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
        console.log(`encounter error: ${e}`);
      }

      if (availableBytes !== null) {
        const required = body.filesize + reserveBytes;
        if (availableBytes < required) {
          console.log(
            `Error Insufficient disk space: available: ${availableBytes}, required: ${required}`,
          );
          throw new BadRequestException(
            'Insufficient disk space on server to accept this upload',
          );
        }
      }
    }
    console.log('test 4');

    const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;
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
      console.log(`No type`);
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
    console.log('successfully inited');
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
  /**
   * Stream master playlist from R2
   * Handles signed URL fetching and stream piping
   * Returns stream response for controller to pipe to client
   */
  async streamMasterPlaylist(
    key: string,
    userId?: string,
    movieId?: string,
  ): Promise<{ stream: any; contentType: string; trackView: boolean }> {
    try {
      const signedUrl = await this.r2Service.getSignedUrl(key, 300);

      const r2Response = await fetch(signedUrl);

      if (!r2Response.ok) {
        throw new Error('Failed to fetch from R2');
      }

      const reader = r2Response.body?.getReader();
      const { Readable } = require('stream');

      const nodeStream = new Readable({
        read() {},
      });

      async function pump() {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) {
            nodeStream.push(null);
            break;
          }
          nodeStream.push(Buffer.from(value));
        }
      }

      pump().catch((err) => {
        console.error('[streamMasterPlaylist] Pump error:', err);
        nodeStream.destroy(err);
      });

      const contentType =
        r2Response.headers.get('content-type') || 'application/octet-stream';

      const shouldTrackView = !!(userId && movieId);

      return {
        stream: nodeStream,
        contentType,
        trackView: shouldTrackView,
      };
    } catch (error) {
      console.error('[streamMasterPlaylist] Error:', error);
      throw error;
    }
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
   *
   * CRITICAL: This should ONLY be called AFTER successful stream setup
   */
  async trackMovieView(userId: string, movieId: string): Promise<boolean> {
    try {
      console.log(
        `tracking video watch history change, movieId: ${movieId}, userId: ${userId}`,
      );
      const cacheKey = `movie:view:${movieId}:user:${userId}`;

      const existingView = await this.redisService.get(cacheKey);
      if (existingView) {
        return false;
      }

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      const movie = await this.movieRepository.findOne({
        where: { id: movieId },
      });
      console.log(`movie:`, movie?.title);
      console.log(`user:`, user?.email);

      if (!user || !movie) {
        return false;
      }

      const viewLog = this.movieViewLogRepository.create({
        user,
        movie,
      });
      await this.movieViewLogRepository.save(viewLog);

      movie.view_count = (movie.view_count || 0) + 1;
      await this.movieRepository.save(movie);

      await this.watchHistoryService.addOrUpdateHistory(userId, movieId);

      await this.redisService.set(cacheKey, '1', 1800);

      return true;
    } catch (error) {
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
          size: '320x180',
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
      await this.assembleChunksToMp4(dir, tempMp4, meta);

      if (!fs.existsSync(tempMp4)) {
        throw new Error(`Failed to assemble chunks to ${tempMp4}`);
      }

      const { size } = fs.statSync(tempMp4);

      meta.status = UploadStatus.CONVERTING;
      meta.updated_at = Date.now();
      meta.progress = 0;
      await this.redisService.set(key, meta, 60 * 60 * 24);

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
        await this.convertToHLS(tempMp4, videoDir, key, meta);

        meta.duration = duration;

        await this.deleteFileSafe(tempMp4);

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

          // Update video with separate URLs for R2 provider
          await this.updateVideo({
            id: videoId,
            url: `${meta.type}/${videoId}/master.m3u8`, // Keep combined URL for backward compatibility
            hlsVodUrl: `${meta.type}/${videoId}/master-vod.m3u8`,
            hlsLiveUrl: `${meta.type}/${videoId}/master-live.m3u8`,
          });
          await this.removeAllFiles(videoDir);
          meta.hls_path = `${remotePrefix}/master.m3u8`;
          meta.status = UploadStatus.COMPLETED;
          meta.updated_at = Date.now();
          await this.redisService.set(key, meta, 60 * 60 * 24);

          console.log(`🎉 Uploaded HLS to R2: ${meta.hls_path}`);
        }

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
      slidingWindowDuration: 120,
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
    const videoStartTime = new Date();

    for (const q of qualities) {
      const hlsDir = path.join(outputDir, q.folder);
      await this.ensureDir(hlsDir);

      console.log(`[HLS] Processing ${q.quality} (${q.height}p)...`);
      const lastUpdate = 0;

      // Initialize HLS state management
      await HLSStateManager.initialize(hlsDir);

      // Generate segments with enhanced error handling
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

      // Mark HLS as ready for processing
      await HLSStateManager.markReady(hlsDir);

      // Create VOD playlist with safe operations
      await this.createVODPlaylistSafe(hlsDir, hlsConfig, videoStartTime);

      // Create LIVE playlist with safe operations
      await this.createLivePlaylistSafe(hlsDir, hlsConfig, videoStartTime);

      console.log(`[HLS] ✓ Created VOD & LIVE playlists for ${q.quality}`);
      index += 1;
    }

    await this.createMasterPlaylistVOD(outputDir, qualities);
    await this.createMasterPlaylistLIVE(outputDir, qualities);
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
      '-sc_threshold 0',
      '-g 48',
      '-keyint_min 48',
      '-force_key_frames expr:gte(t,n_forced*6)',
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

  /**
   * Create VOD playlist with safe operations and state management
   *
   * PRODUCTION HLS PIPELINE:
   * 1. Wait for HLS to be ready (state management)
   * 2. Validate playlist completeness
   * 3. Parse segments safely without ffprobe
   * 4. Create playlist atomically
   */
  private async createVODPlaylistSafe(
    hlsDir: string,
    hlsConfig: HLSConfig,
    videoStartTime: Date,
  ): Promise<void> {
    try {
      // Wait for HLS processing to complete
      await HLSStateManager.waitForReady(hlsDir, 1200000); // 20 minutes timeout for large files

      // Validate HLS readiness with detailed logging
      console.log(
        `[createVODPlaylistSafe] Checking HLS readiness for ${hlsDir}`,
      );
      const validation =
        await SafePlaylistOperations.isHLSReadyForProcessing(hlsDir);
      if (!validation.success) {
        console.warn(
          `[createVODPlaylistSafe] HLS not ready: ${validation.error}`,
        );

        // Check if this is a "playlist not ready" error that should trigger fallback
        if (
          validation.error &&
          validation.error.includes('still being written by ffmpeg')
        ) {
          console.log(
            `[createVODPlaylistSafe] Playlist not ready, using fallback generation`,
          );
          const fallbackConfig = {
            segmentDuration: hlsConfig.segmentDuration,
            targetDuration: Math.ceil(hlsConfig.segmentDuration) + 1,
            enableProgramDateTime: hlsConfig.enableProgramDateTime,
            videoStartTime,
          };

          await FallbackPlaylistGenerator.generateFallbackVODPlaylist(
            hlsDir,
            fallbackConfig,
          );
          console.log(
            `[createVODPlaylistSafe] Fallback VOD playlist generated successfully`,
          );
          return; // Exit early, fallback handled
        }

        // Check what files exist for debugging
        try {
          const files = await fsPromises.readdir(hlsDir);
          console.log(`[createVODPlaylistSafe] Files in ${hlsDir}:`, files);
        } catch (error) {
          console.warn(
            `[createVODPlaylistSafe] Cannot read directory ${hlsDir}:`,
            error,
          );
        }
        throw new Error(`HLS not ready: ${validation.error}`);
      }
      console.log(`[createVODPlaylistSafe] HLS ready for processing`);

      // Try to get segments safely from playlist (no ffprobe)
      let segments: { duration: number; file: string }[] = [];
      const segmentsResult =
        await SafePlaylistOperations.getAllSegmentDurations(hlsDir);

      if (segmentsResult.success) {
        segments = segmentsResult.data.durations.map((d: any) => ({
          duration: d.duration,
          file: d.filename,
        }));
      } else {
        console.warn(
          `[createVODPlaylistSafe] Could not get segments from playlist: ${segmentsResult.error}`,
        );
        // Fallback: generate playlist from available segments
        console.log(
          `[createVODPlaylistSafe] Using fallback playlist generation`,
        );
        const fallbackConfig = {
          segmentDuration: hlsConfig.segmentDuration,
          targetDuration: Math.ceil(hlsConfig.segmentDuration) + 1,
          enableProgramDateTime: hlsConfig.enableProgramDateTime,
          videoStartTime,
        };

        await FallbackPlaylistGenerator.generateFallbackVODPlaylist(
          hlsDir,
          fallbackConfig,
        );
        console.log(
          `[createVODPlaylistSafe] Fallback VOD playlist generated successfully`,
        );
        return; // Exit early, fallback handled
      }

      const outputPath = path.join(hlsDir, 'index.m3u8');

      const lines: string[] = [];
      lines.push('#EXTM3U');
      lines.push('#EXT-X-VERSION:7');
      lines.push('#EXT-X-PLAYLIST-TYPE:VOD');

      const maxDuration = Math.max(...segments.map((s) => s.duration));
      const targetDuration = Math.ceil(maxDuration) + 1;
      lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
      lines.push('#EXT-X-MEDIA-SEQUENCE:0');

      if (hlsConfig.enableProgramDateTime) {
        lines.push(`#EXT-X-PROGRAM-DATE-TIME:${videoStartTime.toISOString()}`);
      }

      for (const segment of segments) {
        lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
        lines.push(segment.file);
      }

      lines.push('#EXT-X-ENDLIST');

      // Create playlist atomically
      const playlistResult = await SafePlaylistOperations.createPlaylistSafely(
        hlsDir,
        lines.join('\n') + '\n',
        'index.m3u8',
      );

      if (!playlistResult.success) {
        throw new Error(`Failed to create playlist: ${playlistResult.error}`);
      }

      console.log(`[HLS] ✓ Created VOD playlist: ${outputPath}`);
    } catch (error) {
      console.error(`[createVODPlaylistSafe] Failed for ${hlsDir}:`, error);
      await HLSStateManager.markFailed(
        hlsDir,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
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

    const maxDuration = Math.max(...segments.map((s) => s.duration));
    const targetDuration = Math.ceil(maxDuration) + 1;
    lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
    lines.push('#EXT-X-MEDIA-SEQUENCE:0');

    if (hlsConfig.enableProgramDateTime) {
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${videoStartTime.toISOString()}`);
    }

    for (const segment of segments) {
      lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      lines.push(segment.file);
    }

    lines.push('#EXT-X-ENDLIST');

    await fsPromises.writeFile(outputPath, lines.join('\n') + '\n');
    console.log(`[HLS] Created VOD playlist: ${outputPath}`);
  }

  /**
   * Create LIVE playlist with safe operations and state management
   *
   * PRODUCTION HLS PIPELINE:
   * 1. Wait for HLS to be ready (state management)
   * 2. Validate playlist completeness
   * 3. Parse segments safely without ffprobe
   * 4. Create playlist atomically
   */
  private async createLivePlaylistSafe(
    hlsDir: string,
    hlsConfig: HLSConfig,
    videoStartTime: Date,
  ): Promise<void> {
    try {
      // Wait for HLS processing to complete
      await HLSStateManager.waitForReady(hlsDir, 1200000); // 20 minutes timeout for large files

      // Validate HLS readiness with detailed logging
      console.log(
        `[createLivePlaylistSafe] Checking HLS readiness for ${hlsDir}`,
      );
      const validation =
        await SafePlaylistOperations.isHLSReadyForProcessing(hlsDir);
      if (!validation.success) {
        console.warn(
          `[createLivePlaylistSafe] HLS not ready: ${validation.error}`,
        );

        // Check if this is a "playlist not ready" error that should trigger fallback
        if (
          validation.error &&
          validation.error.includes('still being written by ffmpeg')
        ) {
          console.log(
            `[createLivePlaylistSafe] Playlist not ready, using fallback generation`,
          );
          const fallbackConfig = {
            segmentDuration: hlsConfig.segmentDuration,
            targetDuration: Math.ceil(hlsConfig.segmentDuration) + 1,
            enableProgramDateTime: hlsConfig.enableProgramDateTime,
            videoStartTime,
          };

          await FallbackPlaylistGenerator.generateFallbackLivePlaylist(
            hlsDir,
            fallbackConfig,
          );
          console.log(
            `[createLivePlaylistSafe] Fallback LIVE playlist generated successfully`,
          );
          return; // Exit early, fallback handled
        }

        // Check what files exist for debugging
        try {
          const files = await fsPromises.readdir(hlsDir);
          console.log(`[createLivePlaylistSafe] Files in ${hlsDir}:`, files);
        } catch (error) {
          console.warn(
            `[createLivePlaylistSafe] Cannot read directory ${hlsDir}:`,
            error,
          );
        }
        throw new Error(`HLS not ready: ${validation.error}`);
      }
      console.log(`[createLivePlaylistSafe] HLS ready for processing`);

      // Try to get segments safely from playlist (no ffprobe)
      let segments: { duration: number; file: string }[] = [];
      const segmentsResult =
        await SafePlaylistOperations.getAllSegmentDurations(hlsDir);

      if (segmentsResult.success) {
        segments = segmentsResult.data.durations.map((d: any) => ({
          duration: d.duration,
          file: d.filename,
        }));
      } else {
        console.warn(
          `[createLivePlaylistSafe] Could not get segments from playlist: ${segmentsResult.error}`,
        );
        // Fallback: generate playlist from available segments
        console.log(
          `[createLivePlaylistSafe] Using fallback playlist generation`,
        );
        const fallbackConfig = {
          segmentDuration: hlsConfig.segmentDuration,
          targetDuration: Math.ceil(hlsConfig.segmentDuration) + 1,
          enableProgramDateTime: hlsConfig.enableProgramDateTime,
          videoStartTime,
        };

        await FallbackPlaylistGenerator.generateFallbackLivePlaylist(
          hlsDir,
          fallbackConfig,
        );
        console.log(
          `[createLivePlaylistSafe] Fallback LIVE playlist generated successfully`,
        );
        return; // Exit early, fallback handled
      }

      const outputPath = path.join(hlsDir, 'live.m3u8');
      const slidingWindowSize = Math.ceil(
        hlsConfig.slidingWindowDuration / hlsConfig.segmentDuration,
      );

      const lines: string[] = [];
      lines.push('#EXTM3U');
      lines.push('#EXT-X-VERSION:7');
      lines.push('#EXT-X-PLAYLIST-TYPE:EVENT');
      const maxDuration = Math.max(...segments.map((s) => s.duration));
      const targetDuration = Math.ceil(maxDuration) + 1;
      lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
      lines.push('#EXT-X-MEDIA-SEQUENCE:0');

      if (hlsConfig.enableProgramDateTime) {
        lines.push(`#EXT-X-PROGRAM-DATE-TIME:${videoStartTime.toISOString()}`);
      }

      lines.push(
        `#EXT-X-CUSTOM-START-TIME:${Math.floor(videoStartTime.getTime() / 1000)}`,
      );
      lines.push(`#EXT-X-CUSTOM-SEGMENT-DURATION:${hlsConfig.segmentDuration}`);
      lines.push(
        `#EXT-X-CUSTOM-REWIND-DURATION:${hlsConfig.slidingWindowDuration}`,
      );

      for (const segment of segments) {
        lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
        lines.push(segment.file);
      }

      // Create playlist atomically
      const playlistResult = await SafePlaylistOperations.createPlaylistSafely(
        hlsDir,
        lines.join('\n') + '\n',
        'live.m3u8',
      );

      if (!playlistResult.success) {
        throw new Error(`Failed to create playlist: ${playlistResult.error}`);
      }

      console.log(`[HLS] ✓ Created LIVE playlist: ${outputPath}`);
    } catch (error) {
      console.error(`[createLivePlaylistSafe] Failed for ${hlsDir}:`, error);
      await HLSStateManager.markFailed(
        hlsDir,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async createLivePlaylist(
    hlsDir: string,
    hlsConfig: HLSConfig,
    videoStartTime: Date,
  ): Promise<void> {
    const segments = await this.getSegmentsInfo(hlsDir);
    const outputPath = path.join(hlsDir, 'live.m3u8');

    const slidingWindowSize = Math.ceil(
      hlsConfig.slidingWindowDuration / hlsConfig.segmentDuration,
    );

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-PLAYLIST-TYPE:EVENT');
    const maxDuration = Math.max(...segments.map((s) => s.duration));
    const targetDuration = Math.ceil(maxDuration) + 1;
    lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
    lines.push('#EXT-X-MEDIA-SEQUENCE:0');

    if (hlsConfig.enableProgramDateTime) {
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${videoStartTime.toISOString()}`);
    }

    lines.push(
      `#EXT-X-CUSTOM-START-TIME:${Math.floor(videoStartTime.getTime() / 1000)}`,
    );
    lines.push(`#EXT-X-CUSTOM-SEGMENT-DURATION:${hlsConfig.segmentDuration}`);
    lines.push(
      `#EXT-X-CUSTOM-REWIND-DURATION:${hlsConfig.slidingWindowDuration}`,
    );

    for (const segment of segments) {
      lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      lines.push(segment.file);
    }

    await fsPromises.writeFile(outputPath, lines.join('\n') + '\n');
    console.log(`[HLS] Created LIVE playlist: ${outputPath}`);
  }

  /**
   * Get segment duration with race condition prevention
   *
   * RACE CONDITION PREVENTION:
   * 1. First try parsing playlist metadata (system-level solution)
   * 2. If playlist unavailable, use safe ffprobe with file stability checking
   * 3. Fallback to default duration if all methods fail
   *
   * This prevents SIGSEGV crashes when ffprobe reads incomplete .ts files
   */
  /**
   * Get segment duration with race condition prevention
   *
   * PRODUCTION HLS PIPELINE:
   * ❌ NO MORE FFMPEG CRASHES
   * ❌ NO MORE ENOENT ERRORS
   * ✅ ONLY USE PLAYLIST METADATA
   * ✅ NO FFMPEG DEPENDENCY FOR DURATION
   *
   * RACE CONDITION PREVENTION:
   * 1. Parse playlist metadata (system-level solution - NO FFMPEG)
   * 2. Fallback to default duration if playlist unavailable
   * 3. NEVER USE FFMPEG FOR SEGMENT DURATION
   *
   * This eliminates SIGSEGV crashes completely by avoiding ffprobe entirely.
   */
  private async getSegmentDuration(segmentPath: string): Promise<number> {
    try {
      // Strategy 1: Parse playlist metadata (preferred - NO FFMPEG dependency)
      const playlistPath = path.join(path.dirname(segmentPath), 'index.m3u8');
      const durationFromPlaylist =
        await HLSPlaylistParser.getSegmentDurationFromPlaylist(
          playlistPath,
          path.basename(segmentPath),
        );

      if (durationFromPlaylist > 0) {
        return durationFromPlaylist;
      }

      // Strategy 2: Fallback to default duration
      // This happens when playlist doesn't exist yet or segment not in playlist
      console.warn(
        `[getSegmentDuration] Playlist not available for ${segmentPath}, using fallback`,
      );
      return 6.0;
    } catch (error) {
      console.error(
        `[getSegmentDuration] Unexpected error for ${segmentPath}:`,
        error,
      );
      return 6.0;
    }
  }

  /**
   * Create VOD-only master playlist
   * Contains only index.m3u8 variants for VOD playback
   */
  private async createMasterPlaylistVOD(
    videoDir: string,
    qualities: any[],
  ): Promise<void> {
    const masterPlaylist = path.join(videoDir, 'master-vod.m3u8');

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-INDEPENDENT-SEGMENTS');
    lines.push('');
    lines.push('# VOD Playlists Only');

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

    await fsPromises.writeFile(masterPlaylist, lines.join('\n') + '\n');
    console.log(`[HLS] Created VOD master playlist: ${masterPlaylist}`);
  }

  /**
   * Create LIVE-only master playlist
   * Contains only live.m3u8 variants for LIVE playback
   */
  private async createMasterPlaylistLIVE(
    videoDir: string,
    qualities: any[],
  ): Promise<void> {
    const masterPlaylist = path.join(videoDir, 'master-live.m3u8');

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-INDEPENDENT-SEGMENTS');
    lines.push('');
    lines.push('# LIVE Playlists Only');

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
    console.log(`[HLS] Created LIVE master playlist: ${masterPlaylist}`);
  }

  /**
   * Legacy method - kept for backward compatibility
   * Creates combined master playlist with both VOD and LIVE variants
   */
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
    console.log(`[HLS] Created combined master playlist: ${masterPlaylist}`);
  }

  private async updateDynamicLivePlaylist(
    hlsDir: string,
    currentTime: Date,
    videoStartTime: Date,
    hlsConfig: HLSConfig,
  ): Promise<void> {
    const segments = await this.getSegmentsInfo(hlsDir);
    const outputPath = path.join(hlsDir, 'live.m3u8');

    const elapsedSeconds =
      (currentTime.getTime() - videoStartTime.getTime()) / 1000;

    const currentSegmentIndex = Math.floor(
      elapsedSeconds / hlsConfig.segmentDuration,
    );

    const windowSize = Math.ceil(
      hlsConfig.slidingWindowDuration / hlsConfig.segmentDuration,
    );
    const startIndex = Math.max(0, currentSegmentIndex - windowSize);
    const endIndex = Math.min(segments.length, currentSegmentIndex + 1);

    const lines: string[] = [];
    lines.push('#EXTM3U');
    lines.push('#EXT-X-VERSION:7');
    lines.push('#EXT-X-PLAYLIST-TYPE:LIVE');
    const maxDuration = Math.max(...segments.map((s) => s.duration));
    const targetDuration = Math.ceil(maxDuration) + 1;
    lines.push(`#EXT-X-TARGETDURATION:${targetDuration}`);
    lines.push(`#EXT-X-MEDIA-SEQUENCE:${startIndex}`);

    if (hlsConfig.enableProgramDateTime && startIndex < segments.length) {
      const segmentTime = new Date(
        videoStartTime.getTime() +
          startIndex * hlsConfig.segmentDuration * 1000,
      );
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${segmentTime.toISOString()}`);
    }

    for (let i = startIndex; i < endIndex; i++) {
      if (i < segments.length) {
        const segment = segments[i];
        lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
        lines.push(segment.file);
      }
    }

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

    // Determine URLs based on provider type
    let hlsVodUrl: string | undefined;
    let hlsLiveUrl: string | undefined;
    let combinedUrl: string;

    if (provider.slug === 'r2') {
      // For R2 provider, use separate URLs
      hlsVodUrl = `${meta.type}/${videoKey}/master-vod.m3u8`;
      hlsLiveUrl = `${meta.type}/${videoKey}/master-live.m3u8`;
      combinedUrl = `${meta.type}/${videoKey}/master.m3u8`; // Keep for backward compatibility
    } else {
      // For local provider, use local URLs
      hlsVodUrl = `local/${videoKey}/master-vod.m3u8`;
      hlsLiveUrl = `local/${videoKey}/master-live.m3u8`;
      combinedUrl = `local/${videoKey}/master.m3u8`; // Keep for backward compatibility
    }

    return this.createVideo({
      movie,
      name: meta.title ?? meta.filename ?? 'Untitled',
      url: combinedUrl, // Keep combined URL for backward compatibility
      hlsVodUrl, // New separate VOD URL
      hlsLiveUrl, // New separate LIVE URL
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
    console.log('test2.1');
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
      console.log('test2.2');

      if (exists) {
        console.log('has already main movie');
        console.log(exists.movie.title);
        console.log(exists.id);
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
      hlsVodUrl,
      hlsLiveUrl,
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
      hlsVodUrl,
      hlsLiveUrl,
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

    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['movie', 'watch_provider'],
    });

    if (!video) {
      throw new NotFoundException('Video does not exist');
    }

    if (movie) {
      video.movie = typeof movie === 'string' ? ({ id: movie } as any) : movie;
    }

    if (watch_provider) {
      video.watch_provider =
        typeof watch_provider === 'string'
          ? ({ id: watch_provider } as any)
          : watch_provider;
    }

    Object.assign(video, updateData);

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
      console.log(`Deleted entire temp directory: ${dir}`);
    } catch (error: any) {
      console.warn(`Could not delete temp directory ${dir}:`, error.message);
    }
  }

  /**
   * Wait for all segments in a directory to become stable
   * Prevents race conditions during HLS generation
   */
  private async waitForSegmentsStable(
    hlsDir: string,
    timeoutMs: number = 10000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const files = await fsPromises.readdir(hlsDir);
        const segmentFiles = files
          .filter((f) => f.startsWith('segment') && f.endsWith('.ts'))
          .map((f) => path.join(hlsDir, f));

        if (segmentFiles.length === 0) {
          // No segments yet, continue waiting
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        // Check if all segments are stable
        const stabilityPromises = segmentFiles.map((file) =>
          FileStabilityChecker.isFileStable(file, {
            checkIntervalMs: 500,
            maxRetries: 2,
            sizeStabilityThresholdMs: 1000,
          }),
        );

        const stabilityResults = await Promise.all(stabilityPromises);

        if (stabilityResults.every((stable) => stable)) {
          console.log(`[HLS] All segments stable in ${hlsDir}`);
          return;
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(
          `[waitForSegmentsStable] Error checking stability:`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.warn(
      `[waitForSegmentsStable] Timeout waiting for segments in ${hlsDir}`,
    );
  }

  /**
   * Enhanced segment info retrieval with error handling
   * Note: This replaces the existing getSegmentsInfo method
   */
  private async getSegmentsInfo(hlsDir: string): Promise<SegmentInfo[]> {
    try {
      const files = await fsPromises.readdir(hlsDir);
      const segmentFiles = files
        .filter((f) => f.startsWith('segment') && f.endsWith('.ts'))
        .sort();

      const segments: SegmentInfo[] = [];

      for (const file of segmentFiles) {
        const filePath = path.join(hlsDir, file);

        // Use enhanced duration detection
        const duration = await this.getSegmentDuration(filePath);

        segments.push({
          duration: duration,
          file: file,
        });
      }

      return segments;
    } catch (error) {
      console.error(
        `[getSegmentsInfo] Failed to get segments from ${hlsDir}:`,
        error,
      );
      return [];
    }
  }

  createVideoStream(videoPath: string, range?: string): StreamResponse {
    const safePath = path.normalize(videoPath).replace(/^(\.\.[/\\])+/, '');
    const videoFilePath = path.join(this.getFinalDir(), safePath);
    console.log(videoFilePath);

    if (!fs.existsSync(videoFilePath)) {
      throw new NotFoundException('Video not found');
    }

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

  /**
   * Get the appropriate HLS playlist URL based on stream type
   * @param videoId - The video ID
   * @param streamType - 'vod' or 'live'
   * @returns The appropriate HLS playlist URL
   */
  async getHlsPlaylistUrl(
    videoId: string,
    streamType: 'vod' | 'live',
  ): Promise<string> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ['watch_provider'],
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Determine the appropriate URL based on stream type and provider
    if (streamType === 'vod') {
      if (video.hlsVodUrl) {
        return video.hlsVodUrl;
      }
      // Fallback to combined master playlist if separate VOD URL doesn't exist
      return video.url;
    } else if (streamType === 'live') {
      if (video.hlsLiveUrl) {
        return video.hlsLiveUrl;
      }
      // Fallback to combined master playlist if separate LIVE URL doesn't exist
      return video.url;
    }

    throw new BadRequestException(
      'Invalid stream type. Must be "vod" or "live"',
    );
  }
}
