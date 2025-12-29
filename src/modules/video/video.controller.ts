import {
  Controller,
  Get,
  Headers,
  Param,
  Res,
  Post,
  Body,
  Put,
  Req,
  HttpCode,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
  UseGuards,
  Delete,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UploadStatus, VideoService } from './video.service';
import { Response, Request } from 'express';
import { randomUUID } from 'crypto';
import { InitUploadVideoDto } from './video.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role, VideoType } from '@/common/enums';
import { ResponseUtil, TokenPayload } from '@/common';
import { R2Service } from '../watch-provider/services/r2.service';
import { MoviePurchaseService } from '../movie-purchase/movie-purchase.service';
import { RequestWithOptionalUser } from '../auth/auth.interface';
import { WatchPartyService } from '../watch-party/watch-party.service';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@Controller('video')
export class VideoController {
  private readonly r2BaseUrl = `${process.env.R2_S3_CLIENT_ENDPOINT}/${process.env.R2_BUCKET_NAME}/videos`;
  constructor(
    private readonly videoService: VideoService,
    private readonly r2Service: R2Service,
    private readonly purchaseService: MoviePurchaseService,
    private readonly watchPartyService: WatchPartyService,
  ) {}

  /**
   * Delete a video by ID
   * DELETE /video/:videoId
   */
  @Delete(':videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async deleteVideo(@Param('videoId') videoId: string) {
    try {
      // Xoá trong database + R2
      await this.videoService.deleteVideoById(videoId);
      return ResponseUtil.success(null, 'Video đã được xoá thành công');
    } catch (err) {
      console.error('[deleteVideo] Error:', err);
      throw new NotFoundException('Không tìm thấy video hoặc xoá thất bại');
    }
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
      message: 'Success',
    };
  }

  @Get('/detail/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async getVideoById(@Param('videoId') videoId: string) {
    const video = await this.videoService.getVideoById(videoId);
    return ResponseUtil.success(video);
  }

  /**
   * Initialize an upload session
   * POST /video/upload/init
   * Body: { movie_id, filename, total_chunks?, filesize? }
   */
  @Post('upload/init')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async initUpload(@Body() body: InitUploadVideoDto) {
    const sessionId = randomUUID();
    const plan = await this.videoService.initUploadVideo(body, sessionId);
    return ResponseUtil.success({ plan }, 'Initialized upload');
  }

  /**
   * Upload a single chunk
   * PUT /video/upload/:sessionId/chunk
   * Headers: x-chunk-index: number
   */
  @Put('upload/:sessionId/chunk')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Headers('x-chunk-index') chunkIndexHeader?: string,
  ) {
    const idx = chunkIndexHeader
      ? parseInt(chunkIndexHeader as any, 10)
      : undefined;

    if (idx === undefined || Number.isNaN(idx)) {
      throw new BadRequestException('Missing or invalid x-chunk-index header');
    }

    await this.videoService.saveChunkStream(sessionId, idx, req);

    return ResponseUtil.success(
      { idx, sessionId },
      'Chunk uploaded successfully',
    );
  }

  @Post('upload/:sessionId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async completeUpload(@Param('sessionId') sessionId: string) {
    // Check status first
    const status = await this.videoService.getUploadStatus(sessionId);

    if (status.status === 'not_found') {
      throw new NotFoundException('Upload session not found');
    }

    if (
      status.status === UploadStatus.ASSEMBLING ||
      status.status === UploadStatus.CONVERTING
    ) {
      throw new BadRequestException('Upload is already being processed');
    }

    if (status.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Upload is already completed');
    }

    // Start async processing
    const result = await this.videoService.assembleChunks(sessionId);

    return ResponseUtil.success(
      result,
      'Upload processing started. Check status endpoint for progress.',
    );
  }

  @Get('upload/:sessionId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async uploadStatus(@Param('sessionId') sessionId: string) {
    const status = await this.videoService.getUploadStatus(sessionId);

    if (status.status === 'not_found') {
      throw new NotFoundException('Upload session not found');
    }

    return ResponseUtil.success({
      ...status,
      message: this.getStatusMessage(status.status),
    });
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

  // /**
  // * Stream master playlist or specific file
  // * GET /video/stream/:videoKey/:fileName
  // */
  // @Get('stream/:videoKey/:fileName')
  // async streamVideo(
  //   @Param('videoKey') videoKey: string,
  //   @Param('fileName') fileName: string,
  //   @Headers('range') range: string,
  //   @Res() res: Response,
  // ) {
  //   const videoPath = `${videoKey}/${fileName}`;

  //   try {
  //     const streamResponse = this.videoService.createVideoStream(videoPath, range);

  //     res.status(streamResponse.headers.statusCode);
  //     res.setHeader('Content-Length', streamResponse.contentLength);
  //     res.setHeader('Accept-Ranges', 'bytes');

  //     if (streamResponse.headers.contentType) {
  //       res.setHeader('Content-Type', streamResponse.headers.contentType);
  //     }
  //     if (streamResponse.headers.contentRange) {
  //       res.setHeader('Content-Range', streamResponse.headers.contentRange);
  //     }
  //     if (streamResponse.headers.cacheControl) {
  //       res.setHeader('Cache-Control', streamResponse.headers.cacheControl);
  //     }

  //     streamResponse.stream.pipe(res);
  //   } catch (error) {
  //     if (error instanceof NotFoundException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to stream video');
  //   }
  // }

  // /**
  //  * Stream video by video key and quality
  //  * GET /video/stream/:videoKey/:quality/:fileName
  //  */
  // @Get('stream/:videoKey/:quality/:fileName')
  // async streamVideoByQuality(
  //   @Param('videoKey') videoKey: string,
  //   @Param('quality') quality: string,
  //   @Param('fileName') fileName: string,
  //   @Headers('range') range: string,
  //   @Res() res: Response,
  // ) {
  //   const videoPath = `${videoKey}/${quality}/${fileName}`;

  //   try {
  //     const streamResponse = this.videoService.createVideoStream(videoPath, range);

  //     res.status(streamResponse.headers.statusCode);
  //     res.setHeader('Content-Length', streamResponse.contentLength);
  //     res.setHeader('Accept-Ranges', 'bytes');

  //     if (streamResponse.headers.contentType) {
  //       res.setHeader('Content-Type', streamResponse.headers.contentType);
  //     }
  //     if (streamResponse.headers.contentRange) {
  //       res.setHeader('Content-Range', streamResponse.headers.contentRange);
  //     }
  //     if (streamResponse.headers.cacheControl) {
  //       res.setHeader('Cache-Control', streamResponse.headers.cacheControl);
  //     }

  //     streamResponse.stream.pipe(res);
  //   } catch (error) {
  //     if (error instanceof NotFoundException) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to stream video');
  //   }
  // }

  @Get('r2/stream/:type/:videoId/:fileName')
  @UseGuards(OptionalJwtAuthGuard)
  async redirectMaster(
    @Req() req: RequestWithOptionalUser,
    @Param('type') type: string,
    @Param('videoId', new ParseUUIDPipe({ version: '4' })) videoId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const user = req.user;
    const key = `videos/${type}/${videoId}/${fileName}`; // videos/Movie/<videoId>/master.m3u8

    // SECURITY: Check permission first
    await this.checkValidPermission(videoId, type, user);

    // FEATURE: Track movie view (increment view count) after permission check passes
    // Only for authenticated users watching MOVIE type videos
    if (type === VideoType.MOVIE && user) {
      const video = await this.videoService.getVideoById(videoId);
      if (video && video.movie) {
        // Async tracking - don't block the stream
        this.videoService
          .trackMovieView(user.sub, video.movie.id)
          .catch((err) => {
            console.error('[redirectMaster] View tracking error:', err);
          });
      }
    }

    // // Lấy signed URL
    // const signedUrl = await this.r2Service.getSignedUrl(key, 300);

    // // Fetch signed URL từ backend
    // const r2Response = await fetch(signedUrl);

    // if (!r2Response.ok) {
    //   throw new NotFoundException('Failed to fetch from R2');
    // }

    // // Set CORS + Content-Type
    // res.setHeader('Access-Control-Allow-Origin', '*');
    // res.setHeader('Content-Type', r2Response.headers.get('content-type') || 'application/octet-stream');

    // // Chuyển ReadableStream của fetch sang Node.js stream
    // const reader = r2Response.body?.getReader();
    // const { Readable } = require('stream');

    // const nodeStream = new Readable({
    //   read() { }
    // });

    // async function pump() {
    //   while (true) {
    //     const { done, value } = await reader!.read();
    //     if (done) {
    //       nodeStream.push(null);
    //       break;
    //     }
    //     nodeStream.push(Buffer.from(value));
    //   }
    // }

    // pump();
    // nodeStream.pipe(res);

    const mockBasePath = join(
      process.cwd(),
      'uploads/videos/75f76b55-7781-49ee-8b7b-6d5dc2988e9b',
    );

    const mockFile = join(mockBasePath, fileName);

    if (!existsSync(mockFile)) {
      throw new NotFoundException(`Mock file not found: ${mockFile}`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

    const stream = createReadStream(mockFile);
    stream.pipe(res);
  }

  @Get('r2/stream/:type/:videoId/:quality/:fileName')
  @UseGuards(OptionalJwtAuthGuard)
  async streamFromR2(
    @Req() req: RequestWithOptionalUser,
    @Param('type') type: string,
    @Param('videoId', new ParseUUIDPipe({ version: '4' })) videoId: string,
    @Param('quality') quality: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const user = req.user;
    const key = `videos/${type}/${videoId}/${quality}/${fileName}`;

    // SECURITY: Check permission first
    await this.checkValidPermission(videoId, type, user);

    // FEATURE: Track movie view (increment view count) after permission check passes
    // Only for authenticated users watching MOVIE type videos
    if (type === VideoType.MOVIE && user) {
      const video = await this.videoService.getVideoById(videoId);
      if (video && video.movie) {
        // Async tracking - don't block the stream
        this.videoService
          .trackMovieView(user.sub, video.movie.id)
          .catch((err) => {
            console.error('[streamFromR2] View tracking error:', err);
          });
      }
    }

    // // Lấy signed URL
    // const signedUrl = await this.r2Service.getSignedUrl(key, 300);

    // // Fetch signed URL từ backend
    // const r2Response = await fetch(signedUrl);

    // if (!r2Response.ok) {
    //   throw new NotFoundException('Failed to fetch from R2');
    // }

    // // Set CORS + Content-Type
    // res.setHeader('Access-Control-Allow-Origin', '*');
    // res.setHeader('Content-Type', r2Response.headers.get('content-type') || 'application/octet-stream');

    // // Chuyển ReadableStream của fetch sang Node.js stream
    // const reader = r2Response.body?.getReader();
    // const { Readable } = require('stream');

    // const nodeStream = new Readable({
    //   read() { }
    // });

    // async function pump() {
    //   while (true) {
    //     const { done, value } = await reader!.read();
    //     if (done) {
    //       nodeStream.push(null);
    //       break;
    //     }
    //     nodeStream.push(Buffer.from(value));
    //   }
    // }

    // pump();
    // nodeStream.pipe(res);

    const mockBasePath = join(
      process.cwd(),
      'uploads/videos/75f76b55-7781-49ee-8b7b-6d5dc2988e9b',
      quality,
    );

    const mockFile = join(mockBasePath, fileName);

    if (!existsSync(mockFile)) {
      throw new NotFoundException(`Mock file not found: ${mockFile}`);
    }

    // Auto detect type
    const contentType = fileName.endsWith('.ts')
      ? 'video/mp2t'
      : fileName.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'application/octet-stream';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);

    const stream = createReadStream(mockFile);
    stream.pipe(res);
  }

  private async checkValidPermission(
    videoId: string,
    type: string,
    user?: TokenPayload,
  ) {
    const video = await this.videoService.getVideoById(videoId);
    if (!video) {
      throw new NotFoundException('Video không hợp lệ hoặc không tồn tại.');
    }

    if (type != video.type) {
      throw new BadRequestException('Invalid video type');
    }

    // SECURITY FIX ISSUE-05: Strictly enforce permission for MOVIE streams
    if (type === VideoType.MOVIE) {
      // CRITICAL: Unauthenticated requests must be rejected with 401
      if (!user) {
        throw new UnauthorizedException(
          'You must be logged in to access this movie stream',
        );
      }

      // Authenticated user: Check if they have valid permission
      const hasPurchased = await this.purchaseService.checkIfUserOwnMovie(
        user.sub,
        video.movie.id,
      );

      const hasWatchPartyTicket =
        await this.watchPartyService.checkTicketPurchased(
          user.sub,
          video.movie.id,
        );

      // If neither purchase nor watch party ticket, reject with 403
      if (!hasPurchased && !hasWatchPartyTicket) {
        throw new ForbiddenException(
          'You do not have permission to stream this movie',
        );
      }
    }
    // For TRAILER, CLIP, etc., no permission check needed (public access)
  }
}
