import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Movie } from "./movie.entity";
import { Genre } from "../genre/genre.entity";
import { Image } from "../image/image.entity";
import { Video } from "../video/video.entity";
import api from "@/common/utils/axios.util";

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private dataSource: DataSource,
  ) { }

  async getSlides() {
    const movies = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.videos', 'videos')
      .take(5)
      .getMany();

    return movies.map(movie => ({
      ...movie,
      videos: movie.videos || [],
    }));
  }

  async checkWithGlobe(url: string) {
    const probe = require('probe-image-size');

    try {
      return await probe(url);
    } catch (err) {
      console.error('Error probing image:', err);
      return null;
    }
  }

  async fetchAllMoviesToDatabase() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Clear existing data
      await queryRunner.manager.clear(Movie);
      await queryRunner.manager.clear(Image);
      console.log('Deleted all movies from database...');

      // Fetch and process genres
      const res = await api.get<{ genres: { id: number, name: string }[] }>('/genre/movie/list', {
        params: { language: 'en' }
      });

      const genres = res.data.genres;
      const savedGenres = await queryRunner.manager.find(Genre);
      const genreMap = new Map<number, Genre>();

      // Process genres
      for (const genre of genres) {
        let savedGenre = savedGenres.find((g) => g.name === genre.name);
        if (!savedGenre) {
          savedGenre = queryRunner.manager.create(Genre, {
            name: genre.name,
            slug: genre.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
          });
          savedGenre = await queryRunner.manager.save(Genre, savedGenre);
        }
        genreMap.set(genre.id, savedGenre);
      }

      const params = {
        include_adult: false,
        include_video: true,
        language: 'en-US',
        sort_by: 'popularity.desc',
      };

      // Fetch first page to get total pages
      const firstPage = await api.get('/discover/movie', { params: { ...params, page: 1 } });
      let totalPage = Math.min(firstPage.data.total_pages, 5);

      // Process movies page by page
      for (let page = 1; page <= totalPage; page++) {
        console.log('Fetching page', page);
        const { data } = await api.get('/discover/movie', {
          params: { ...params, page }
        });

        const moviesToSave: Movie[] = [];

        for (const movie of data.results) {
          let poster: Image | undefined;
          let backdrop: Image | undefined;

          // Process poster
          if (movie.poster_path) {
            const posterUrl = `https://image.tmdb.org/t/p/original${movie.poster_path}`;
            const posterResult = await this.checkWithGlobe(posterUrl);
            if (posterResult) {
              poster = queryRunner.manager.create(Image, {
                url: posterUrl,
                alt: movie.title,
                width: posterResult.width,
                height: posterResult.height,
                bytes: posterResult.length,
              });
              poster = await queryRunner.manager.save(Image, poster);
            }
          }

          // Process backdrop
          if (movie.backdrop_path) {
            const backdropUrl = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
            const backdropResult = await this.checkWithGlobe(backdropUrl);
            if (backdropResult) {
              backdrop = queryRunner.manager.create(Image, {
                url: backdropUrl,
                alt: movie.title,
                width: backdropResult.width,
                height: backdropResult.height,
                bytes: backdropResult.length,
              });
              backdrop = await queryRunner.manager.save(Image, backdrop);
            }
          }

          // Map genre IDs to actual Genre entities
          const movieGenres = movie.genre_ids
            .map(id => genreMap.get(id))
            .filter((genre): genre is Genre => genre !== undefined);

          // Create movie entity with relations
          const movieEntity = queryRunner.manager.create(Movie, {
            title: movie.title,
            description: movie.overview,
            poster: poster,
            backdrop: backdrop,
            releaseDate: movie.release_date,
            voteAverage: movie.vote_average,
            voteCount: movie.vote_count,
            popularity: movie.popularity,
            adult: movie.adult,
            video: movie.video,
            originalLanguage: movie.original_language,
            originalTitle: movie.original_title,
            language: "en-US",
            genres: movieGenres,
            originalId: movie.id,
          });

          moviesToSave.push(movieEntity);
        }

        // Save movies in batch
        await queryRunner.manager.save(Movie, moviesToSave);
        console.log('Inserted page', page);
      }

      // Commit transaction
      await queryRunner.commitTransaction();
      console.log(`Finished fetching top ${20 * totalPage} movies!`);
    } catch (err) {
      console.error('Error while fetching movies:', err);
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}