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

@Controller('video')
export class VideoController {
  private readonly r2BaseUrl = `${process.env.R2_S3_CLIENT_ENDPOINT}/${process.env.R2_BUCKET_NAME}/videos`;
  constructor(
    private readonly videoService: VideoService,
    private readonly r2Service: R2Service,
    private readonly purchaseService: MoviePurchaseService
  ) {

  }

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
      message: "Success"
    };
  }

  @Get('/detail/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async getVideoById(
    @Param('videoId') videoId: string
  ) {
    const video = await this.videoService.getVideoById(videoId);
    return ResponseUtil.success(video)
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
    const plan = await this.videoService.createUploadSession(sessionId, body);
    return ResponseUtil.success({ plan }, "Initialized upload")
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
    const idx = chunkIndexHeader ? parseInt(chunkIndexHeader as any, 10) : undefined;

    if (idx === undefined || Number.isNaN(idx)) {
      throw new BadRequestException('Missing or invalid x-chunk-index header');
    }

    await this.videoService.saveChunkStream(sessionId, idx, req);

    return ResponseUtil.success({ idx, sessionId }, 'Chunk uploaded successfully')
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

    if (status.status === UploadStatus.ASSEMBLING || status.status === UploadStatus.CONVERTING) {
      throw new BadRequestException('Upload is already being processed');
    }

    if (status.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Upload is already completed');
    }

    // Start async processing
    const result = await this.videoService.assembleChunks(sessionId);

    return ResponseUtil.success(result, 'Upload processing started. Check status endpoint for progress.')
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
    })
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
    @Param('type') type: string,        // Ví dụ: "movies"
    @Param('videoId') videoId: string,  // UUID của video
    @Param('fileName') fileName: string,// Ví dụ: "master.m3u8"
    @Res() res: Response,
  ) {
    const user = req.user;
    const key = `videos/${type}/${videoId}/${fileName}`; // videos/Movie/<videoId>/master.m3u8

    const video = await this.videoService.getVideoById(videoId);
    if (!video) {
      throw new NotFoundException("Video không hợp lệ hoặc không tồn tại.")
    }

    if (type != video.type) {
      throw new BadRequestException("Invalid video type");
    }

    // Nếu người dùng có đăng nhập, kiểm tra quyền mua
    if (type === VideoType.MOVIE)
      if (user) {
        const hasAccess = await this.purchaseService.checkIfUserOwnMovie(
          user.sub,
          video.movie.id,
        );

        if (!hasAccess) {
          throw new ForbiddenException('Bạn chưa mua phim này');
        }
      } else {
        console.log(user);
        throw new UnauthorizedException();
      }

    try {
      const signedUrl = await this.r2Service.getSignedUrl(key, 300); // 5 phút
      res.redirect(302, signedUrl);
    } catch (err) {
      console.error('Failed to sign master file', err);
      throw new NotFoundException('Master file not found');
    }
  }

  @Get('r2/stream/:type/:videoId/:quality/:fileName')
  @UseGuards(OptionalJwtAuthGuard)
  async redirectQuality(
    @Req() req: RequestWithOptionalUser,
    @Param('type') type: string,
    @Param('videoId') videoId: string,
    @Param('quality') quality: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    console.log('type:', type, 'videoId:', videoId, 'fileName:', fileName, 'quality:', quality)
    const user = req.user;
    const key = `videos/${type}/${videoId}/${quality}/${fileName}`; //videos/Movie/<videoId>/1080/master.m3u8

    const video = await this.videoService.getVideoById(videoId);
    if (!video) {
      throw new NotFoundException("Video không hợp lệ hoặc không tồn tại.")
    }

    if (type != video.type) {
      throw new BadRequestException("Invalid video type");
    }

    // Nếu người dùng có đăng nhập, kiểm tra quyền mua
    if (type === VideoType.MOVIE)
      if (user) {
        const hasAccess = await this.purchaseService.checkIfUserOwnMovie(
          user.sub,
          video.movie.id,
        );

        if (!hasAccess) {
          throw new ForbiddenException('Bạn chưa mua phim này');
        }
      } else {
        console.log(user);
        throw new UnauthorizedException();
      }

    try {
      const signedUrl = await this.r2Service.getSignedUrl(key, 300); // 5 phút
      res.redirect(302, signedUrl);
    } catch (err) {
      console.error('Failed to sign master file', err);
      throw new NotFoundException('Master file not found');
    }
  }
}
