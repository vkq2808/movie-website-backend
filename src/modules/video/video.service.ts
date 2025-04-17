import { Injectable } from "@nestjs/common";
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VideoService {
  constructor() { }

  async getVideoByPath(video_path: string) {
    const videoPath = path.resolve(__dirname, "..", "..", "..", "src", "videos", video_path);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = this.parseRange(fileSize, video_path);
    const { start, end } = range;
    const fileStream = fs.createReadStream(videoPath, { start, end });
    const headers = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "video/mp4",
    };
    return {
      headers,
      fileStream,
    };
  }

  parseRange(size: number, path: string) {
    const range = {
      start: 0,
      end: size - 1,
    };

    return range;
  }
}