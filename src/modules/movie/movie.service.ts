import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, EntityManager } from 'typeorm';
import { Movie } from './movie.entity';
import { Genre } from '../genre/genre.entity';
import { Image } from '../image/image.entity';
import { Video } from '../video/video.entity';
import { AlternativeTitleService } from './alternative-title.service';
import { AlternativeOverviewService } from './alternative-overview.service';
import { Language } from '../language/language.entity';
import { LanguageService } from '../language/language.service';
import api from '@/common/utils/axios.util';
import { modelNames } from '@/common/constants/model-name.constant';
import { TOP_LANGUAGES } from '@/common/constants/languages.constant';

// Common parameters for movie discovery
const baseParams = {
  include_adult: false,
  include_video: true,
  sort_by: 'popularity.desc',
};
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
    private readonly alternativeTitleService: AlternativeTitleService,
    private readonly alternativeOverviewService: AlternativeOverviewService,
    private readonly languageService: LanguageService,
    private dataSource: DataSource,
  ) {
    // this.fetchAllMoviesToDatabase();
  }

  async getSlides() {
    const movies = await this.movieRepository
      .createQueryBuilder('movie')
      .innerJoinAndSelect('movie.genres', 'genre')
      .innerJoinAndSelect('movie.poster', 'poster')
      .innerJoinAndSelect('movie.backdrop', 'backdrop')
      .take(5)
      .getMany();

    return movies.map((movie) => ({
      ...movie,
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
  async clearExistingData(queryRunner: QueryRunner) {
    // Clear existing data in the database
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.ALTERNATIVE_TITLE_MODEL_NAME}" CASCADE`,
    );
    // await queryRunner.query(
    //   `TRUNCATE TABLE "${modelNames.LANGUAGE_MODEL_NAME}" CASCADE`,
    // );
    // await queryRunner.query(
    //   `TRUNCATE TABLE "${modelNames.GENRE_MODEL_NAME}" CASCADE`,
    // );
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.IMAGE_MODEL_NAME}" CASCADE`,
    );
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.MOVIE_MODEL_NAME}" CASCADE`,
    );
    console.log('Deleted all movies from database...');
  }

  async fetchAllMoviesToDatabase() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Step 1: Clear existing data
      console.log('Clearing existing data...');
      await this.clearExistingData(queryRunner);

      // Step 2: Initialize languages in batches
      console.log('Initializing languages in batches...');
      const topLanguages = await this.initializeLanguagesInBatches();
      if (!topLanguages.length) {
        throw new Error('Failed to initialize languages');
      }

      // Step 3: Fetch and process genres for each language
      const genreMapByLanguage = new Map<string, Map<number, Genre>>();
      console.log('Fetching and initializing genres for languages...');

      for (const language of topLanguages) {
        console.log(`Initializing genres for ${language.name} (${language.iso_639_1})`);
        const genreMap = await this.initializeGenresForLanguage(language);
        genreMapByLanguage.set(language.iso_639_1, genreMap);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }

      // Step 4: Process movies for each language
      const pagesToFetch = 3;
      let totalMoviesFetched = 0;

      for (const language of topLanguages) {
        console.log(`\n--- Fetching movies for ${language.name} (${language.iso_639_1}) ---`);

        const params = {
          ...baseParams,
          language: language.iso_639_1,
        };

        // Get total pages for this language
        const firstPage = await api.get('/discover/movie', {
          params: { ...params, page: 1 },
        });
        const totalPages = Math.min(firstPage.data.total_pages, pagesToFetch);

        // Get genre map for current language
        const genreMap = genreMapByLanguage.get(language.iso_639_1);
        if (!genreMap) {
          console.warn(`No genre map found for ${language.name}, skipping...`);
          continue;
        }

        // Process pages in sequence
        for (let page = 1; page <= totalPages; page++) {
          console.log(`Fetching page ${page} for ${language.name}`);
          try {
            const { data } = await api.get<{
              total_pages: number;
              results: [{
                id: number;
                title: string;
                original_title: string;
                overview: string;
                release_date: string;
                poster_path?: string;
                backdrop_path?: string;
                genre_ids: number[];
              }];
            }>('/discover/movie', {
              params: { ...params, page },
            });

            // Process movies in smaller batches
            const BATCH_SIZE = 5;
            for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
              const batch = data.results.slice(i, i + BATCH_SIZE);

              try {
                const savedBatchMovie = await this.processMovieBatch(batch, language, genreMap);
                totalMoviesFetched += batch.length;

                // Process alternative titles only for the first language
                if (language === topLanguages[0]) {
                  if (savedBatchMovie)
                    await Promise.all(
                      savedBatchMovie.map(async (movie) => {
                        const alternativeTitles = await this.fetchAlternativeTitlesFromTMDB(movie.original_id);
                        if (alternativeTitles.length > 0) {
                          await this.alternativeTitleService.importAlternativeTitles(
                            movie.id,
                            alternativeTitles,
                          );
                        }
                      })
                    );
                }
              } catch (error) {
                console.error('Error processing movie batch:', error);
                // Log error but continue with next batch
              }

              await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }
          } catch (error) {
            console.error(`Error fetching page ${page} for ${language.name}:`, error);
            // Log error but continue with next page
          }
        }
      }

      console.log(`Successfully imported ${totalMoviesFetched} movies in ${topLanguages.length} languages!`);
    } catch (error) {
      console.error('Error while importing movies:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Fetches alternative titles for a movie from TMDB API
   * @param movieId TMDB movie ID
   * @returns Array of alternative titles with country codes
   */ private async fetchAlternativeTitles(
    movieId: number,
  ): Promise<{ title: string; country_code: string; type?: string }[]> {
    try {
      const response = await api.get(`/movie/${movieId}/alternative_titles`);

      if (
        !response.data ||
        !response.data.titles ||
        !response.data.titles.length
      ) {
        return [];
      }

      return response.data.titles.map((title) => ({
        title: title.title,
        country_code: title.iso_3166_1, // ISO 3166-1 country code
        type: title.type || 'alternative', // Some APIs provide a type field, default to 'alternative'
      }));
    } catch (error) {
      console.error(
        `Error fetching alternative titles for movie ${movieId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get alternative titles for a specific movie
   * @param movieId Movie UUID
   * @returns Array of alternative titles
   */
  async getAlternativeTitles(movieId: string) {
    return this.alternativeTitleService.findAllByMovieId(movieId);
  }

  /**
   * Get movie details by ID
   * @param id Movie UUID
   * @returns Movie details
   */
  async getMovieById(id: string) {
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['genres', 'poster', 'backdrop'],
    });

    if (!movie) {
      throw new Error(`Movie with ID ${id} not found`);
    }

    return movie;
  }

  /**
   * Import alternative titles for a movie from TMDB
   * @param movieId Movie UUID
   * @param tmdbId TMDB movie ID
   * @returns Array of imported alternative titles
   */
  async importAlternativeTitlesFromTMDB(movieId: string, tmdbId: number) {
    const movie = await this.getMovieById(movieId);

    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }

    const alternativeTitles = await this.fetchAlternativeTitles(tmdbId);

    if (alternativeTitles.length === 0) {
      return { message: 'No alternative titles found for this movie' };
    }

    const savedTitles =
      await this.alternativeTitleService.importAlternativeTitles(
        movieId,
        alternativeTitles,
      );

    return {
      message: `Successfully imported ${savedTitles.length} alternative titles`,
      titles: savedTitles,
    };
  }

  /**
   * Update a movie with alternative titles from TMDB
   * @param movieId Movie UUID
   * @returns Result of the update operation
   */
  async updateMovieWithAlternativeTitles(movieId: string) {
    const movie = await this.getMovieById(movieId);

    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }

    // Get the original TMDB ID
    const tmdbId = movie.original_id;

    if (!tmdbId) {
      return {
        success: false,
        message: 'No TMDB ID found for this movie',
      };
    } // Fetch alternative titles from TMDB
    const alternativeTitles = await this.fetchAlternativeTitles(tmdbId);

    if (alternativeTitles.length === 0) {
      return {
        success: true,
        message: 'No alternative titles found for this movie',
        count: 0,
      };
    }

    // Delete existing alternative titles for this movie to avoid duplicates
    const existingTitles =
      await this.alternativeTitleService.findAllByMovieId(movieId);

    if (existingTitles.length > 0) {
      for (const title of existingTitles) {
        await this.alternativeTitleService.remove(title.id);
      }
    } // Import new alternative titles
    const savedTitles =
      await this.alternativeTitleService.importAlternativeTitles(
        movieId,
        alternativeTitles,
      );

    return {
      success: true,
      message: `Successfully updated movie with ${savedTitles.length} alternative titles`,
      count: savedTitles.length,
      titles: savedTitles,
    };
  }

  /**
   * Get all movies with their alternative titles
   * @param page Page number (starting from 1)
   * @param limit Number of movies per page
   * @returns Paginated list of movies with their alternative titles
   */
  async getMoviesWithAlternativeTitles(page = 1, limit = 10) {
    // Calculate offset
    const offset = (page - 1) * limit;

    // First get movies with basic relations
    const [movies, totalCount] = await this.movieRepository.findAndCount({
      relations: ['genres', 'poster', 'backdrop'],
      skip: offset,
      take: limit,
      order: {
        popularity: 'DESC',
      },
    });

    // Then get all alternative titles for these movies in one query
    const movieIds = movies.map(m => m.id);
    const allTitles = movieIds.length > 0 ?
      await this.alternativeTitleService.findAllByMovieIds(movieIds) : [];

    // Create a map of movie ID to titles for O(1) lookup
    const titlesByMovieId = new Map();
    for (const title of allTitles) {
      // Check if title.movie exists before accessing its id property
      if (title && title.movie && title.movie.id) {
        if (!titlesByMovieId.has(title.movie.id)) {
          titlesByMovieId.set(title.movie.id, []);
        }
        titlesByMovieId.get(title.movie.id).push(title);
      }
    }

    // Map the movies with their titles
    const moviesWithTitles = movies.map(movie => ({
      ...movie,
      alternative_titles: titlesByMovieId.get(movie.id) || []
    }));

    return {
      data: moviesWithTitles,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Get movies by language
   * @param languageIsoCode ISO 639-1 language code
   * @param page Page number (starting from 1)
   * @param limit Number of movies per page
   * @returns Paginated list of movies for the specified language
   */
  async getMoviesByLanguage(languageIsoCode: string, page = 1, limit = 10) {
    // Calculate offset
    const offset = (page - 1) * limit;

    // Find language entity
    const language = await this.languageService.findOne({ iso_639_1: languageIsoCode });

    if (!language) {
      return {
        data: [],
        meta: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
        },
      };
    }

    // Query movies that have this language in spoken_languages
    const queryBuilder = this.movieRepository.createQueryBuilder('movie')
      .innerJoinAndSelect('movie.genres', 'genre')
      .innerJoinAndSelect('movie.poster', 'poster')
      .innerJoinAndSelect('movie.backdrop', 'backdrop')
      .innerJoin('movie.spoken_languages', 'language', 'language.id = :languageId', { languageId: language.id })
      .orderBy('movie.popularity', 'DESC')
      .skip(offset)
      .take(limit);

    const [movies, totalCount] = await queryBuilder.getManyAndCount();

    // Then get all alternative titles for these movies in one query
    const movieIds = movies.map(m => m.id);
    const allTitles = movieIds.length > 0 ?
      await this.alternativeTitleService.findAllByMovieIds(movieIds) : [];

    // Create a map of movie ID to titles for O(1) lookup
    const titlesByMovieId = new Map();
    for (const title of allTitles) {
      // Check if title.movie exists before accessing its id property
      if (title && title.movie && title.movie.id) {
        if (!titlesByMovieId.has(title.movie.id)) {
          titlesByMovieId.set(title.movie.id, []);
        }
        titlesByMovieId.get(title.movie.id).push(title);
      }
    }

    // Map the movies with their titles
    const moviesWithTitles = movies.map(movie => ({
      ...movie,
      alternative_titles: titlesByMovieId.get(movie.id) || []
    }));

    return {
      data: moviesWithTitles,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        language: {
          iso_639_1: language.iso_639_1,
          name: language.name,
          english_name: language.english_name
        }
      },
    };
  }
  /**
   * Create a new movie with language integration
   * @param movie_data Movie data to create
   * @returns Created movie entity
   */ async createMovie(
    movieData: Partial<Movie> & { languageIsoCode?: string },
  ): Promise<Movie> {
    // Process language if provided
    let language: Language | null = null;

    if (movieData.languageIsoCode) {
      // Find or create the language
      language = await this.languageService.findOrCreate({
        iso_639_1: movieData.languageIsoCode,
      });
    }

    // Create the movie entity without original_language for now
    const movieWithoutLanguage = { ...movieData };
    delete (movieWithoutLanguage as any).languageIsoCode; // Remove the ISO code property

    const movie = this.movieRepository.create(movieWithoutLanguage);

    // Set original_language relation if language was found/created
    if (language) {
      movie.original_language = language;
    }

    // Save the movie
    const savedMovie = await this.movieRepository.save(movie);

    // If language was found/created, associate it with the movie
    if (language) {
      // Since we're using ManyToMany, we need to set up the relationship
      if (!savedMovie.spoken_languages) {
        savedMovie.spoken_languages = [];
      }
      savedMovie.spoken_languages.push(language);
      await this.movieRepository.save(savedMovie);
    }

    return savedMovie;
  }

  /**
   * Update a movie with language integration
   * @param id Movie ID
   * @param movie_data Movie data to update
   * @returns Updated movie entity
   */ async updateMovie(
    id: string,
    movieData: Partial<Movie> & { languageIsoCode: string },
  ): Promise<Movie> {
    // Find the movie
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['spoken_languages', 'genres', 'poster', 'backdrop'],
    });

    if (!movie) {
      throw new Error(`Movie with ID ${id} not found`);
    }

    // Process language if provided
    if (movieData.languageIsoCode) {
      // Find or create the language
      const language = await this.languageService.findOrCreate({
        iso_639_1: movieData.languageIsoCode,
      });

      // Update original language relation
      movie.original_language = language;

      // Check if the language is already in spoken_languages
      const existingLanguage = movie.spoken_languages?.find(
        (lang) => lang.iso_639_1 === language.iso_639_1,
      );

      // Add language to spoken_languages if not already present
      if (!existingLanguage) {
        if (!movie.spoken_languages) {
          movie.spoken_languages = [];
        }
        movie.spoken_languages.push(language);
      }
    }

    // Remove languageIsoCode from the data before updating other properties
    const updateData = { ...movieData };
    delete (updateData as any).languageIsoCode;

    // Update other movie properties
    Object.assign(movie, updateData);

    // Save the updated movie
    const updatedMovie = await this.movieRepository.save(movie);

    return updatedMovie;
  }

  /**
   * Add a language to a movie
   * @param movieId Movie ID
   * @param languageIsoCode ISO 639-1 language code
   * @returns Updated movie with added language
   */ async addLanguageToMovie(
    movieId: string,
    languageIsoCode: string,
  ): Promise<Movie> {
    // Find the movie
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      relations: ['spoken_languages'],
    });

    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }

    // Find or create the language
    const language = await this.languageService.findOrCreate({
      iso_639_1: languageIsoCode,
    });

    // Check if language is already added to the movie
    const languageExists = movie.spoken_languages?.some(
      (lang) => lang.iso_639_1 === languageIsoCode,
    );

    if (languageExists) {
      return movie; // Language already exists, no need to update
    }

    // Add language to the movie
    if (!movie.spoken_languages) {
      movie.spoken_languages = [];
    }

    movie.spoken_languages.push(language);

    // Save the updated movie
    return this.movieRepository.save(movie);
  }

  /**
   * Remove a language from a movie
   * @param movieId Movie ID
   * @param languageIsoCode ISO 639-1 language code
   * @returns Updated movie with language removed
   */
  async removeLanguageFromMovie(
    movieId: string,
    languageIsoCode: string,
  ): Promise<Movie> {
    // Find the movie
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      relations: ['spoken_languages'],
    });

    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }

    // Check if movie has spoken languages
    if (!movie.spoken_languages || movie.spoken_languages.length === 0) {
      return movie; // No languages to remove
    }

    // Filter out the language to remove
    movie.spoken_languages = movie.spoken_languages.filter(
      (lang) => lang.iso_639_1 !== languageIsoCode,
    );

    // Save the updated movie
    return this.movieRepository.save(movie);
  }

  private async initializeLanguagesInBatches(): Promise<Language[]> {
    const BATCH_SIZE = 5;
    const languages: Language[] = [];
    const topLanguages = TOP_LANGUAGES;

    for (let i = 0; i < topLanguages.length; i += BATCH_SIZE) {
      const batch = topLanguages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(lang =>
        this.languageService.findOrCreate({ iso_639_1: lang.code })
          .catch(error => {
            console.error(`Failed to initialize language ${lang.code}:`, error);
            return null;
          })
      );

      const batchResults = await Promise.all(batchPromises);
      languages.push(...batchResults.filter((lang): lang is Language => lang !== null));

      // Add a small delay between batches to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return languages;
  }

  private async initializeGenresForLanguage(language: Language): Promise<Map<number, Genre>> {
    const genreMap = new Map<number, Genre>();

    try {
      const response = await api.get<{ genres: { id: number; name: string }[] }>(
        '/genre/movie/list',
        { params: { language: language.iso_639_1 } }
      );

      const genres = response.data.genres;
      for (let i = 0; i < genres.length; i++) {
        const genre = genres[i];
        if (!genre.name?.trim()) {
          console.warn(`Empty genre name for ID ${genre.id}, skipping...`);
          continue;
        }

        const genreName = genre.name.trim();

        // Try to find existing genre by original_id
        let savedGenre = await this.genreRepository.findOne({
          where: { original_id: genre.id }
        });

        if (!savedGenre) {
          // Create a new genre using the helper method
          const genreData = Genre.create(genreName, language.iso_639_1);
          savedGenre = this.genreRepository.create({
            ...genreData,
            original_id: genre.id
          });
          savedGenre = await this.genreRepository.save(savedGenre);
          console.log(`Saved new genre: ${genreName} (${language.iso_639_1})`);
        } else {
          // Add or update the name for this language
          const existingNameIndex = savedGenre.names.findIndex(n => n.iso_639_1 === language.iso_639_1);
          if (existingNameIndex >= 0) {
            savedGenre.names[existingNameIndex].name = genreName;
          } else {
            savedGenre.names.push({ name: genreName, iso_639_1: language.iso_639_1 });
          }
          savedGenre = await this.genreRepository.save(savedGenre);
        }

        genreMap.set(genre.id, savedGenre);
      }
    } catch (error) {
      console.error(`Failed to fetch genres for language ${language.iso_639_1}:`, error);
    }

    return genreMap;
  }

  private async processMovieBatch(
    movies: any[],
    language: Language,
    genreMap: Map<number, Genre>
  ): Promise<Movie[]> {
    try {
      // Process all movies in the batch
      const processedMovies = await Promise.all(
        movies.map(async (movieData) => {
          try {
            // Check if movie already exists by original_id
            const existingMovie = await this.movieRepository.findOne({
              where: { original_id: movieData.id },
              relations: ['genres', 'spoken_languages', 'original_language']
            });

            if (existingMovie) {
              // If movie exists in a different language, create alternative title and overview
              if (existingMovie.original_language.iso_639_1 !== language.iso_639_1) {
                await this.alternativeTitleService.importAlternativeTitles(
                  existingMovie.id,
                  [{
                    title: movieData.title,
                    country_code: language.iso_639_1,
                    type: 'translation'
                  }]
                );

                // If overview is different, save it as an alternative overview
                if (movieData.overview && movieData.overview !== existingMovie.overview) {
                  await this.alternativeOverviewService.saveAlternativeOverview(
                    existingMovie.id,
                    movieData.overview,
                    language.iso_639_1
                  );
                }

                // Add the language to spoken languages if not already present
                const hasLanguage = existingMovie.spoken_languages.some(
                  lang => lang.iso_639_1 === language.iso_639_1
                );
                if (!hasLanguage) {
                  existingMovie.spoken_languages.push(language);
                  await this.movieRepository.save(existingMovie);
                }

                return null; // Skip creating new movie
              }
              return null; // Skip if movie already exists in this language
            }

            // Process movie images
            const [poster, backdrop] = await Promise.all([
              movieData.poster_path
                ? this.processMovieImage(
                  this.dataSource.manager,
                  `https://image.tmdb.org/t/p/original${movieData.poster_path}`,
                  movieData.title
                )
                : null,
              movieData.backdrop_path
                ? this.processMovieImage(
                  this.dataSource.manager,
                  `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`,
                  movieData.title
                )
                : null,
            ]);

            // Map genres from genre_ids to actual Genre entities
            const movieGenres = movieData.genre_ids
              ?.map((id: number) => genreMap.get(id))
              .filter((g): g is Genre => !!g) || [];

            // Create movie entity
            return this.movieRepository.create({
              title: movieData.title,
              original_title: movieData.original_title,
              overview: movieData.overview,
              release_date: movieData.release_date,
              spoken_languages: [language],
              original_language: language,
              poster: poster || undefined,
              backdrop: backdrop || undefined,
              genres: movieGenres,
              original_id: movieData.id
            });
          } catch (error) {
            console.error(`Failed to process movie ${movieData.title}:`, error);
            return null;
          }
        })
      );

      // Filter out failed movies and save successful ones
      const validMovies = processedMovies.filter((movie): movie is Movie => movie !== null);
      if (validMovies.length > 0) {
        const savedMovies = await this.movieRepository.save(validMovies);
        console.log(`Successfully saved ${savedMovies.length} movies`);
        return savedMovies;
      }
      return [];
    } catch (error) {
      console.error('Failed to save movie batch:', error);
      return [];
    }
  }

  private async processMovieImage(
    manager: EntityManager,
    url: string,
    alt: string
  ): Promise<Image | null> {
    try {
      const result = await this.checkWithGlobe(url);
      if (!result) return null;

      const image = manager.create(Image, {
        url,
        alt,
        width: result.width,
        height: result.height,
        bytes: result.length
      });

      return await manager.save(Image, image);
    } catch (error) {
      console.error(`Failed to process image ${url}:`, error);
      return null;
    }
  }

  private async fetchAlternativeTitlesFromTMDB(
    movieId: number,
  ): Promise<{ title: string; country_code: string; type?: string }[]> {
    try {
      const response = await api.get(`/movie/${movieId}/alternative_titles`);

      if (
        !response.data ||
        !response.data.titles ||
        !response.data.titles.length
      ) {
        return [];
      }

      return response.data.titles.map((title) => ({
        title: title.title,
        country_code: title.iso_3166_1,
        type: title.type || 'alternative',
      }));
    } catch (error) {
      console.error(
        `Error fetching alternative titles for movie ${movieId}:`,
        error,
      );
      return [];
    }
  }
}