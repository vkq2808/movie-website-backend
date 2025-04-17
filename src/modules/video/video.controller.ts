import { Controller, Get, Param, Res } from "@nestjs/common";
import { VideoService } from "./video.service";


@Controller("video")
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
  ) { }

  @Get(":video_path")
  async getVideoByPath(@Res() res, @Param() params: any) {
    const video = await this.videoService.getVideoByPath(params.video_path);

    res.writeHead(206, video.headers);
    video.fileStream.pipe(res);
  }
}