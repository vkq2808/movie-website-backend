import { modelNames } from "@/common/constants/model-name.constant";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as fs from 'fs';
import { Model } from "mongoose";
import * as path from 'path';
import { Video } from "./video.schema";
import { Movie } from "../movie/movie.schema";
import { api } from "@/common/utils";

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(modelNames.VIDEO_MODEL_NAME) private readonly video: Model<Video>,
    @InjectModel(modelNames.MOVIE_MODEL_NAME) private readonly movie: Model<Movie>,
  ) {
    // this.init();
  }

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

  async fetchVideoByMovieId(movie: Movie) {
    const videos = await api.get<{ id: string, results: any[] }>(`/movie/${movie.originalId.toString()}/videos`)
    console.log('Fetched videos for movie:', movie.title, videos.data.results.length);

    const videoResults = videos.data.results.map((video) => {
      return {
        movieId: movie._id,
        iso_649_1: video.iso_639_1,
        iso_3166_1: video.iso_3166_1,
        name: video.name,
        key: video.key,
        site: video.site,
        size: video.size,
        type: video.type,
        official: video.official,
        publishedAt: new Date(video.published_at),
      };
    });

    await this.video.deleteMany({ movieId: movie._id });
    const savedVideos = await this.video.insertMany(videoResults);
    await this.movie.updateOne({ _id: movie._id }, { videos: savedVideos.map((video) => video._id) });
    console.log('Inserted videos for movie:', movie.title);
  }

  async init() {
    const movies = await this.movie.find({});
    console.log('Start fetching videos for movies:', movies.length);
    if (movies.length === 0) {
      console.log('No movies found in the database.');
      return;
    }

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      await this.fetchVideoByMovieId(movie);
    }
    console.log('Finished fetching videos for movies:', movies.length);
  }
}