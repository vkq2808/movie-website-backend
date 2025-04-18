import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Movie } from "./movie.schema";
import { modelNames } from "@/common/constants/model-name.constant";
import api from "@/common/utils/axios.util";
import { Genre } from "../genre/genre.schema";


@Injectable()
export class MovieService {
  constructor(
    @InjectModel(modelNames.MOVIE_MODEL_NAME) private readonly movie: Model<Movie>,
    @InjectModel(modelNames.GENRE_MODEL_NAME) private readonly genre: Model<Genre>
  ) {
    // this.fetchAllMoviesToDatabase();
  }

  async getSlides() {
    return this.movie.find(
      {},
      { _id: 1, title: 1, posterUrl: 1 },
      { limit: 5 }
    )
  }

  async fetchAllMoviesToDatabase() {

    await this.movie.deleteMany({});
    console.log('Deleted all movies from database...');


    // Fetch all genres
    const genres = await api.get('/genre/movie/list', {
      params: { language: 'en' }
    });

    const savedGenres = await this.genre.find();

    const genreMap = savedGenres.reduce((acc, genre) => {
      acc[genre.name] = genre._id;
      return acc;
    }, {});
    console.log("genre mapped successfully, total genres: ", savedGenres.length);

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
    if (totalPage > 60) {
      totalPage = 60;
    }

    for (let i = 1; i <= totalPage; i++) {
      console.log('Fetching page ', i);
      params.page = i;
      const { data } = await api.get('/discover/movie', {
        params
      });
      console.log('Fetched page ', i, ' inserting to database...');
      const movies = (data.results as any[]).map((movie: any) => new this.movie({
        title: movie.title,
        description: movie.overview,
        posterUrl: movie.poster_path,
        backdropPath: movie.backdrop_path,
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
      }));

      await this.movie.insertMany(movies);
      console.log('Inserted page ', i);
    }
    console.log('Finished fetching top 1200 movies!');
  }
}