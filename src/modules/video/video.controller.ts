import {
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Res,
  Post,
  Body,
  Put,
  Req,
  HttpCode,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { UploadStatus, VideoService } from './video.service';
import { Response, Request } from 'express';
import { randomUUID } from 'crypto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('video')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
  ) {

  }
  /**
   * Get videos by movie ID
   * GET /video/movie/:movieId
   */
  @Get('movie/:movieId')
  async getVideosByMovieId(@Param('movieId') movieId: string) {
    const videos = await this.videoService.findVideosByMovieId(movieId);
    return {
      success: true,
      data: videos,
    };
  }

  /**
   * Initialize an upload session
   * POST /video/upload/init
   * Body: { movie_id, filename, total_chunks?, filesize? }
   */
  @Post('upload/init')
  async initUpload(@Body() body: { movie_id: string; filename: string; total_chunks?: number; filesize?: number }) {
    const sessionId = randomUUID();
    const plan = await this.videoService.createUploadSession(sessionId, body);
    return {
      success: true,
      data: plan,
    };
  }

  /**
   * Upload a single chunk
   * PUT /video/upload/:sessionId/chunk
   * Headers: x-chunk-index: number
   */
  @Put('upload/:sessionId/chunk')
  @HttpCode(200)
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Headers('x-chunk-index') chunkIndexHeader?: string,
  ) {
    const idx = chunkIndexHeader ? parseInt(chunkIndexHeader as any, 10) : undefined;

    if (idx === undefined || Number.isNaN(idx)) {
      throw new BadRequestException('Missing or invalid x-chunk-index header');
    }

    await this.videoService.saveChunkStream(sessionId, idx, req);

    return {
      success: true,
      chunk_index: idx,
      message: 'Chunk uploaded successfully',
    };
  }

  @Post('upload/:sessionId/complete')
  async completeUpload(@Param('sessionId') sessionId: string) {
    // Check status first
    const status = await this.videoService.getUploadStatus(sessionId);

    if (status.status === 'not_found') {
      throw new NotFoundException('Upload session not found');
    }

    if (status.status === UploadStatus.ASSEMBLING || status.status === UploadStatus.CONVERTING) {
      throw new BadRequestException('Upload is already being processed');
    }

    if (status.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Upload is already completed');
    }

    // Start async processing
    this.processUploadAsync(sessionId);

    return {
      success: true,
      message: 'Upload processing started. Check status endpoint for progress.',
      sessionId,
    };
  }

  @Get('upload/:sessionId/status')
  async uploadStatus(@Param('sessionId') sessionId: string) {
    const status = await this.videoService.getUploadStatus(sessionId);

    if (status.status === 'not_found') {
      throw new NotFoundException('Upload session not found');
    }

    // Calculate progress percentage
    let progress = 0;
    if (status.total_chunks && status.uploaded_count) {
      progress = Math.round((status.uploaded_count / status.total_chunks) * 100);
    }

    return {
      success: true,
      data: {
        ...status,
        progress,
        message: this.getStatusMessage(status.status),
      },
    };
  }
  /**
   * Helper method to get user-friendly status messages
   */
  private getStatusMessage(status: string): string {
    const messages = {
      in_progress: 'Đang upload chunks',
      assembling: 'Đang ghép các chunks lại',
      converting: 'Đang chuyển đổi sang HLS',
      completed: 'Hoàn thất',
      failed: 'Thất bại',
      not_found: 'Không tìm thấy session',
    };
    return messages[status] || 'Unknown status';
  }

  /**
   * Process upload asynchronously
   */
  private async processUploadAsync(sessionId: string) {
    try {
      await this.videoService.assembleChunks(sessionId);
      console.log(`✓ Upload ${sessionId} completed successfully`);
    } catch (error) {
      console.error(`✗ Upload ${sessionId} failed:`, error);
    }
  }

  /**
  * Stream master playlist or specific file
  * GET /video/stream/:videoKey/:fileName
  */
  @Get('stream/:videoKey/:fileName')
  async streamVideo(
    @Param('videoKey') videoKey: string,
    @Param('fileName') fileName: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    const videoPath = `${videoKey}/${fileName}`;

    try {
      const streamResponse = this.videoService.createVideoStream(videoPath, range);

      res.status(streamResponse.headers.statusCode);
      res.setHeader('Content-Length', streamResponse.contentLength);
      res.setHeader('Accept-Ranges', 'bytes');

      if (streamResponse.headers.contentType) {
        res.setHeader('Content-Type', streamResponse.headers.contentType);
      }
      if (streamResponse.headers.contentRange) {
        res.setHeader('Content-Range', streamResponse.headers.contentRange);
      }
      if (streamResponse.headers.cacheControl) {
        res.setHeader('Cache-Control', streamResponse.headers.cacheControl);
      }

      streamResponse.stream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to stream video');
    }
  }

  /**
   * Stream video by video key and quality
   * GET /video/stream/:videoKey/:quality/:fileName
   */
  @Get('stream/:videoKey/:quality/:fileName')
  async streamVideoByQuality(
    @Param('videoKey') videoKey: string,
    @Param('quality') quality: string,
    @Param('fileName') fileName: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    const videoPath = `${videoKey}/${quality}/${fileName}`;

    try {
      const streamResponse = this.videoService.createVideoStream(videoPath, range);

      res.status(streamResponse.headers.statusCode);
      res.setHeader('Content-Length', streamResponse.contentLength);
      res.setHeader('Accept-Ranges', 'bytes');

      if (streamResponse.headers.contentType) {
        res.setHeader('Content-Type', streamResponse.headers.contentType);
      }
      if (streamResponse.headers.contentRange) {
        res.setHeader('Content-Range', streamResponse.headers.contentRange);
      }
      if (streamResponse.headers.cacheControl) {
        res.setHeader('Cache-Control', streamResponse.headers.cacheControl);
      }

      streamResponse.stream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to stream video');
    }
  }


  // @Post('r2/upload')
  // @UseInterceptors(FileInterceptor('file', {
  //   limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
  //   fileFilter: (req, file, cb) => {
  //     if (!file.mimetype.startsWith('video/')) {
  //       return cb(new Error('Only video files are allowed!'), false);
  //     }
  //     cb(null, true);
  //   },
  // }))
  // async uploadVideo(@UploadedFile() file: Express.Multer.File) {
  //   const result = await this.videoService.uploadVideoCloudflareR2(file);
  //   return {
  //     message: 'Video uploaded successfully!',
  //     data: result,
  //   };
  // }
}
