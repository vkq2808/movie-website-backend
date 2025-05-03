import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Movie } from "./movie.schema";
import { modelNames } from "@/common/constants/model-name.constant";
import api from "@/common/utils/axios.util";
import { Genre } from "../genre/genre.schema";
import { Image } from "../image/image.schema";
import { Video } from "../video/video.schema";

@Injectable()
export class MovieService {
  constructor(
    @InjectModel(modelNames.MOVIE_MODEL_NAME) private readonly movie: Model<Movie>,
    @InjectModel(modelNames.GENRE_MODEL_NAME) private readonly genre: Model<Genre>,
    @InjectModel(modelNames.IMAGE_MODEL_NAME) private readonly image: Model<Image>,
    @InjectModel(modelNames.VIDEO_MODEL_NAME) private readonly video: Model<Video>,
  ) {
    // this.fetchAllMoviesToDatabase();
  }

  async getSlides() {
    const movies = await this.movie
      .find({}, null, { limit: 5 })
      .populate({ path: 'videos', model: this.video })
      .lean();
    return movies;
  }

  async checkWithGlobe(url: string) {
    const probe = require('probe-image-size');

    return probe(url)
      .then(result => {
        return result;
      })
      .catch(err => {
        console.error('Lỗi:', err);
      });
  }

  async fetchAllMoviesToDatabase() {

    await this.movie.deleteMany({});
    await this.image.deleteMany({});
    console.log('Deleted all movies from database...');


    // Fetch all genres
    const res = await api.get<{ genres: { id: number, name: string }[] }>('/genre/movie/list', {
      params: { language: 'en' }
    });

    const genres = res.data.genres;

    const savedGenres = await this.genre.find().lean();

    let genreMap: { [key: number]: any } = {};
    for (let i = 0; i < genres.length; i++) {
      const genre = genres[i];
      const savedGenre = savedGenres.find((g) => g.name === genre.name);
      if (savedGenre) {
        genreMap[genre.id] = savedGenre._id;
      } else {
        const newGenre = new this.genre({
          name: genre.name,
          slug: genre.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
        });
        await newGenre.save();
        genreMap[genre.id] = newGenre._id;
      }
    }

    let params = {
      include_adult: false,
      include_video: true,
      language: 'en-US',
      page: 1,
      sort_by: 'popularity.desc',
    }

    const firstPage = await api.get('/discover/movie', {
      params
    });

    console.log('Fetched page 1..., total pages: ', firstPage.data.total_pages);

    let totalPage = firstPage.data.total_pages;
    if (totalPage > 5) {
      totalPage = 5;
    }

    for (let i = 1; i <= totalPage; i++) {
      console.log('Fetching page ', i);
      params.page = i;
      const { data } = await api.get('/discover/movie', {
        params
      });
      console.log('Fetched page ', i, ' inserting to database...');
      const movies: any[] = [];
      for (let i = 0; i < data.results.length; i++) {
        const movie = data.results[i];

        // Xử lý poster
        const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/original${movie.poster_path}` : null;
        let posterId: any = null;
        if (posterUrl) {
          const result = await this.checkWithGlobe(posterUrl);
          if (result) {
            const image = new this.image({
              url: posterUrl,
              alt: movie.title,
              width: result.width,
              height: result.height,
              bytes: result.length,
            });
            await image.save();
            posterId = image._id;
          } else {
            console.log('Image not found: ', posterUrl);
          }
        }

        // Xử lý backdrop
        const backdropPath = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null;
        let backdropId: any = null;
        if (backdropPath) {
          const result = await this.checkWithGlobe(backdropPath);
          if (result) {
            const image = new this.image({
              url: backdropPath,
              alt: movie.title,
              width: result.width,
              height: result.height,
              bytes: result.length,
            });
            await image.save();
            backdropId = image._id;
          } else {
            console.log('Image not found: ', backdropPath);
          }
        }

        // Tạo đối tượng phim mới
        const newMovie = new this.movie({
          title: movie.title,
          description: movie.overview,
          posterUrl: posterId,
          backdropUrl: backdropId,
          releaseDate: movie.release_date,
          voteAverage: movie.vote_average,
          voteCount: movie.vote_count,
          popularity: movie.popularity,
          adult: movie.adult,
          video: movie.video,
          originalLanguage: movie.original_language,
          originalTitle: movie.original_title,
          language: "en-US",
          genres: movie.genre_ids.map((genreId: number) => genreMap[genreId]),
          originalId: movie.id,
        });

        movies.push(newMovie);
      }

      await this.movie.insertMany(movies);
      console.log('Inserted page ', i);
    }
    console.log(`Finished fetching top ${20 * totalPage} movies!`);
  }
}