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
  ) { }

  /**
   * Delete a video by ID
   * DELETE /video/:videoId
   */
  @Delete(':videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async deleteVideo(@Param('videoId') videoId: string) {
    try {
      await this.videoService.deleteVideoById(videoId);
      return ResponseUtil.success(null, 'Video đã được xóa thành công');
    } catch (err) {
      console.error('[deleteVideo] Error:', err);
      throw new NotFoundException('Video không tìm thấy hoặc xóa thất bại');
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
      message: 'Thành công',
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
    console.log(`sessionId: ${sessionId}`);
    const plan = await this.videoService.initUploadVideo(body, sessionId);
    return ResponseUtil.success({ plan }, 'Khởi tạo tải lên');
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
      throw new BadRequestException(
        'Thiếu hoặc không hợp lệ header x-chunk-index',
      );
    }

    await this.videoService.saveChunkStream(sessionId, idx, req);
    return ResponseUtil.success(
      { idx, sessionId },
      'Chunk đã tải lên thành công',
    );
  }

  @Post('upload/:sessionId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async completeUpload(@Param('sessionId') sessionId: string) {
    const status = await this.videoService.getUploadStatus(sessionId);
    if (status.status === 'not_found') {
      throw new NotFoundException('Phiên tải lên không tìm thấy');
    }
    if (
      status.status === UploadStatus.ASSEMBLING ||
      status.status === UploadStatus.CONVERTING
    ) {
      throw new BadRequestException('Tải lên đang được xử lý');
    }
    if (status.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Tải lên đã hoàn thành');
    }
    const result = await this.videoService.assembleChunks(sessionId);
    return ResponseUtil.success(
      result,
      'Bắt đầu xử lý tải lên. Kiểm tra endpoint trạng thái để xem tiến trình.',
    );
  }

  @Get('upload/:sessionId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async uploadStatus(@Param('sessionId') sessionId: string) {
    const status = await this.videoService.getUploadStatus(sessionId);
    if (status.status === 'not_found') {
      throw new NotFoundException('Phiên tải lên không tìm thấy');
    }
    return ResponseUtil.success({
      ...status,
      message: this.getStatusMessage(status.status),
    });
  } /**
   * Helper method to get user-friendly status messages
   */
  private getStatusMessage(status: string): string {
    const messages = {
      in_progress: 'Đang tải lên các chunk',
      assembling: 'Đang lắp ráp các chunk',
      converting: 'Đang chuyển đổi sang HLS',
      completed: 'Hoàn thành',
      failed: 'Thất bại',
      not_found: 'Phiên không tìm thấy',
    };
    return messages[status] || 'Trạng thái không xác định';
  }

  /**
   * Stream master playlist (master.m3u8)
   * FIX: ONLY this endpoint tracks views
   * FIX: View tracking happens AFTER successful stream setup
   * FIX: Only tracks for master.m3u8 (not variant playlists)
   */
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
    const key = `videos/${type}/${videoId}/${fileName}`;

    // SECURITY: Check permission first
    await this.checkValidPermission(videoId, type, user);

    try {
      // FIX: Delegate streaming to service (separation of concerns)
      if (type === VideoType.MOVIE && user && fileName === 'master.m3u8') {
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
      const streamResult = await this.videoService.streamMasterPlaylist(key);

      // Set response headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', streamResult.contentType);

      // Pipe stream to response
      streamResult.stream.pipe(res);

      // FIX: Track view ONLY if:
      // 1. This is a MOVIE type
      // 2. User is authenticated
      // 3. Stream was successfully set up (we're here without throwing)
      // 4. This is master.m3u8 (not variant playlists like index.m3u8 or live.m3u8)

    } catch (error) {
      // FIX: If stream fails, no view is tracked
      console.error('[redirectMaster] Stream error:', error);
      throw new NotFoundException('Không thể phát video');
    }
  }

  /**
   * Stream segments (.ts files) and variant playlists
   * FIX: CRITICAL - This endpoint NEVER tracks views
   * Segments are requested hundreds of times per video
   */
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

    try {
      if (type === VideoType.MOVIE && user && fileName === 'index.m3u8') {
        this.videoService.getVideoById(videoId).then(
          (video) => {
            if (video && video.movie) {
              // Async tracking - don't block the stream
              this.videoService
                .trackMovieView(user.sub, video.movie.id)
                .catch((err) => {
                  console.error('[redirectMaster] View tracking error:', err);
                });
            }
          });
      }
      // FIX: Delegate to service
      const streamResult = await this.videoService.streamMasterPlaylist(key);

      // Set response headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', streamResult.contentType);

      // Pipe stream to response
      streamResult.stream.pipe(res);

      // FIX: ❌ NO VIEW TRACKING HERE
      // This endpoint is called hundreds of times per video (segments)
      // View tracking is ONLY done in redirectMaster for master.m3u8
    } catch (error) {
      console.error('[streamFromR2] Stream error:', error);
      throw new NotFoundException('Không thể phát đoạn video');
    }
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
      throw new BadRequestException('Loại video không hợp lệ');
    }
    if (type === VideoType.MOVIE) {
      if (!user) {
        throw new UnauthorizedException(
          'Bạn phải đăng nhập để truy cập luồng phim',
        );
      }

      const hasPurchased = await this.purchaseService.checkIfUserOwnMovie(
        user.sub,
        video.movie.id,
      );

      const hasWatchPartyTicket =
        await this.watchPartyService.checkTicketPurchased(
          user.sub,
          video.movie.id,
        );
      if (!hasPurchased && !hasWatchPartyTicket) {
        throw new ForbiddenException('Bạn không có quyền phát phim này');
      }
    }
  }
}
