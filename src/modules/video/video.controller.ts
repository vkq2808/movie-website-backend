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
} from '@nestjs/common';
import { VideoService } from './video.service';
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
   * Initialize an upload session. Returns a sessionId used for chunk uploads.
   * Body: { movie_id, filename, total_chunks?, filesize? }
   */
  @Post('upload/init')
  async initUpload(@Body() body: { movie_id: string; filename: string; total_chunks?: number; filesize?: number }) {
    const sessionId = randomUUID();
    const plan = await this.videoService.createUploadSession(sessionId, body);
    return plan;
  }

  /**
   * Upload a chunk. Client should PUT raw binary to this endpoint and include header 'x-chunk-index'
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
      throw new NotFoundException('Missing x-chunk-index header');
    }

    await this.videoService.saveChunkStream(sessionId, idx, req);
    return { ok: true };
  }

  /**
   * Complete upload and assemble chunks
   */
  @Post('upload/:sessionId/complete')
  async completeUpload(@Param('sessionId') sessionId: string) {
    const video = await this.videoService.assembleChunks(sessionId);
    return { ok: true, video };
  }

  @Get('upload/:sessionId/status')
  async uploadStatus(@Param('sessionId') sessionId: string) {
    const status = await this.videoService.getUploadStatus(sessionId);
    return status;
  }

  @Get(':video_path')
  @Header('Accept-Ranges', 'bytes')
  streamVideo(
    @Res() res: Response,
    @Param('video_path') videoPath: string,
    @Headers('range') range?: string,
  ) {
    const { stream, contentLength, headers } =
      this.videoService.createVideoStream(videoPath, range);

    res.writeHead(headers.statusCode, {
      'Content-Range': headers.contentRange,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4',
    });

    stream.pipe(res);
  }

  @Post('r2/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) {
        return cb(new Error('Only video files are allowed!'), false);
      }
      cb(null, true);
    },
  }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const result = await this.videoService.uploadVideoCloudflareR2(file);
    return {
      message: 'Video uploaded successfully!',
      data: result,
    };
  }
}
