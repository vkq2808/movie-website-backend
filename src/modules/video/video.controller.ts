import { Controller, Get, Header, Headers, Param, Res } from '@nestjs/common';
import { VideoService } from './video.service';
import { Response } from 'express';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get(':video_path')
  @Header('Accept-Ranges', 'bytes')
  async streamVideo(
    @Res() res: Response,
    @Param('video_path') videoPath: string,
    @Headers('range') range?: string,
  ) {
    const { stream, contentLength, headers } =
      await this.videoService.createVideoStream(videoPath, range);

    res.writeHead(headers.statusCode, {
      'Content-Range': headers.contentRange,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4',
    });

    stream.pipe(res);
  }
}
