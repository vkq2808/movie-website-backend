import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  QueryRunner,
  EntityManager,
  DeepPartial,
} from 'typeorm';
import { MovieStatus } from '@/common/enums';
import { Movie } from '../../movie/entities/movie.entity';
import { Genre } from '../../genre/genre.entity';
import { Image } from '../../image/image.entity';
import { Video } from '../../video/video.entity';
import { AlternativeTitleService } from '../../movie/services/alternative-title.service';
import { AlternativeOverviewService } from '../../movie/services/alternative-overview.service';
import { Language } from '../../language/language.entity';
import { LanguageService } from '../../language/language.service';
import api from '@/common/utils/axios.util';
import { modelNames } from '@/common/constants/model-name.constant';
import { TOP_LANGUAGES } from '@/common/constants/languages.constant';
import { getLanguageFromCountry } from '@/common/utils/locale.util';
import probe from 'probe-image-size';
import { AlternativeOverview } from '../../movie/entities/alternative-overview.entity';
import { Person } from '../../person/person.entity';
import { MovieCast } from '../../movie/entities/movie-cast.entity';
import { MovieCrew } from '../../movie/entities/movie-crew.entity';
import { Keyword } from '../../keyword/keyword.entity';
import { AlternativeTagline } from '../../movie/entities/alternative-tagline.entity';
import { WatchProviderService } from '../../watch-provider/watch-provider.service';
import { MovieWatchProviderService } from '../../watch-provider/movie-watch-provider.service';

// Map TMDB status strings to our MovieStatus enum
function mapTmdbStatusToMovieStatus(status: string): MovieStatus {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'released':
      return MovieStatus.PUBLISHED;
    case 'canceled':
    case 'cancelled':
      return MovieStatus.ARCHIVED;
    // Rumored, Planned, In Production, Post Production, etc.
    default:
      return MovieStatus.DRAFT;
  }
}

const baseParams = {
  include_adult: false,
  include_video: true,
  sort_by: 'popularity.desc',
};

@Injectable()
export class MovieCrawlerService {
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
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(MovieCast)
    private readonly movieCastRepository: Repository<MovieCast>,
    @InjectRepository(MovieCrew)
    private readonly movieCrewRepository: Repository<MovieCrew>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(AlternativeTagline)
    private readonly alternativeTaglineRepository: Repository<AlternativeTagline>,
    private readonly watchProviderService: WatchProviderService,
    private readonly movieWatchProviderService: MovieWatchProviderService,
    private dataSource: DataSource,
  ) {
    // this.fetchAllMoviesToDatabase();
  }

  async fetchAllMoviesToDatabase() {
    console.log('========== START: Fetching all movies from TMDB ==========');
    console.time('Total import time');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      console.log('Step 1: Clearing existing data...');
      await this.clearExistingData(queryRunner);
      console.log('✅ Existing data cleared successfully');

      console.log('Step 2: Initializing languages in batches...');
      const topLanguages = await this.initializeLanguagesInBatches();
      console.log(`✅ Initialized ${topLanguages.length} languages`);

      if (!topLanguages.length) {
        throw new Error('Failed to initialize languages');
      }

      console.log(
        'Step 3: Fetching and processing genres for each language...',
      );
      const genreMapByLanguage = new Map<string, Map<number, Genre>>();

      for (const language of topLanguages) {
        console.log(
          `Processing genres for language: ${language.name} (${language.iso_639_1})...`,
        );
        const genreMap = await this.initializeGenresForLanguage(language);
        console.log(
          `✅ Processed ${genreMap.size} genres for ${language.name}`,
        );
        genreMapByLanguage.set(language.iso_639_1, genreMap);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log('Step 4: Processing movies for each language...');
      const pagesToFetch = 3;
      let totalMoviesFetched = 0;
      let totalMoviesSaved = 0;

      for (const language of topLanguages) {
        console.log(
          `\n📽️ Processing movies for language: ${language.name} (${language.iso_639_1})...`,
        );
        const params = { ...baseParams, language: language.iso_639_1 };

        console.log(`Fetching page information for ${language.name}...`);
        const firstPage = await api.get<{ total_pages: number }>(
          '/discover/movie',
          { params: { ...params, page: 1 } },
        );
        const totalPagesAvailable = firstPage.data.total_pages;
        const totalPages = Math.min(totalPagesAvailable, pagesToFetch);
        console.log(
          `Found ${totalPagesAvailable} total pages, will fetch ${totalPages} pages`,
        );

        const genreMap = genreMapByLanguage.get(language.iso_639_1);
        if (!genreMap) {
          console.warn(`No genre map found for ${language.name}, skipping...`);
          continue;
        }

        for (let page = 1; page <= totalPages; page++) {
          console.log(
            `\n  🔄 Processing page ${page}/${totalPages} for ${language.name}...`,
          );
          try {
            const { data } = await api.get<{
              total_pages: number;
              results: Array<{
                id: number;
                title: string;
                original_title: string;
                overview: string;
                release_date: string;
                poster_path?: string;
                backdrop_path?: string;
                genre_ids: number[];
              }>;
            }>('/discover/movie', { params: { ...params, page } });

            console.log(
              `  📋 Found ${data.results.length} movies on page ${page}`,
            );

            const BATCH_SIZE = 5;
            for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
              const batch = data.results.slice(i, i + BATCH_SIZE);
              const batchStart = i + 1;
              const batchEnd = Math.min(i + BATCH_SIZE, data.results.length);
              console.log(
                `    🎬 Processing batch of movies ${batchStart}-${batchEnd}/${data.results.length}...`,
              );
              try {
                const savedBatchMovie = await this.processMovieBatch(
                  batch,
                  language,
                  genreMap,
                );
                totalMoviesFetched += batch.length;
                totalMoviesSaved += savedBatchMovie.length;
              } catch (error) {
                console.error('    ❌ Error processing movie batch:', error);
              }
              console.log(
                `    ⏱️ Rate limiting - waiting 1 second before next batch...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(
              `  ❌ Error fetching page ${page} for ${language.name}:`,
              error,
            );
          }
        }
      }

      console.log('\n========== IMPORT SUMMARY ==========');
      console.log(`Total movies fetched: ${totalMoviesFetched}`);
      console.log(`Total movies saved: ${totalMoviesSaved}`);
      console.log(`Languages processed: ${topLanguages.length}`);
      console.timeEnd('Total import time');
      console.log('========== END: Import completed successfully ==========');
    } catch (error) {
      console.error('❌ Fatal error while importing movies:', error);
      console.timeEnd('Total import time');
      console.log('========== END: Import failed ==========');
      throw error;
    } finally {
      await queryRunner.release();
      console.log('Query runner released');
    }
  }

  async clearExistingData(queryRunner: QueryRunner) {
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.ALTERNATIVE_TITLE}" CASCADE`,
    );
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.IMAGE}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE}" CASCADE`);
  }

  async checkWithGlobe(url: string) {
    try {
      const probeFn = probe as unknown as (u: string) => Promise<ImageProbe>;
      const result = await probeFn(url);
      return result;
    } catch (err) {
      console.error('Error probing image:', err);
      return null;
    }
  }

  private async initializeLanguagesInBatches(): Promise<Language[]> {
    const BATCH_SIZE = 5;
    const languages: Language[] = [];
    const topLanguages = TOP_LANGUAGES;
    for (let i = 0; i < topLanguages.length; i += BATCH_SIZE) {
      const batch = topLanguages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((lang) =>
        this.languageService
          .findOrCreate({ iso_639_1: lang.code })
          .catch((error) => {
            console.error(`Failed to initialize language ${lang.code}:`, error);
            return null;
          }),
      );
      const batchResults = await Promise.all(batchPromises);
      languages.push(
        ...batchResults.filter((lang): lang is Language => lang !== null),
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return languages;
  }

  private async initializeGenresForLanguage(
    language: Language,
  ): Promise<Map<number, Genre>> {
    const genreMap = new Map<number, Genre>();
    try {
      const response = await api.get<{
        genres: { id: number; name: string }[];
      }>('/genre/movie/list', { params: { language: language.iso_639_1 } });
      const genres = response.data.genres;
      for (let i = 0; i < genres.length; i++) {
        const genre = genres[i];
        if (!genre.name?.trim()) {
          console.warn(`Empty genre name for ID ${genre.id}, skipping...`);
          continue;
        }
        const genreName = genre.name.trim();
        let savedGenre = await this.genreRepository.findOne({
          where: { original_id: genre.id },
        });
        if (!savedGenre) {
          const genreData = Genre.create(genreName, language.iso_639_1);
          savedGenre = this.genreRepository.create({
            ...genreData,
            original_id: genre.id,
          });
          savedGenre = await this.genreRepository.save(savedGenre);
        } else {
          const existingNameIndex = savedGenre.names.findIndex(
            (n) => n.iso_639_1 === language.iso_639_1,
          );
          if (existingNameIndex >= 0) {
            savedGenre.names[existingNameIndex].name = genreName;
          } else {
            savedGenre.names.push({
              name: genreName,
              iso_639_1: language.iso_639_1,
            });
          }
          savedGenre = await this.genreRepository.save(savedGenre);
        }
        genreMap.set(genre.id, savedGenre);
      }
    } catch (error) {
      console.error(
        `Failed to fetch genres for language ${language.iso_639_1}:`,
        error,
      );
    }
    return genreMap;
  }

  private async processMovieImage(
    manager: EntityManager,
    url: string,
    alt: string,
  ): Promise<Image | null> {
    try {
      const result = await this.checkWithGlobe(url);
      if (!result) return null;
      const image = manager.create(Image, {
        url,
        alt,
        width: result.width,
        height: result.height,
        bytes: result.length,
      });
      return await manager.save(Image, image);
    } catch (error) {
      console.error(`Failed to process image ${url}:`, error);
      return null;
    }
  }

  private async processMovieBatch(
    movies: TMDBDiscoverMovie[],
    language: Language,
    genreMap: Map<number, Genre>,
  ): Promise<Movie[]> {
    try {
      const processedMovies = await Promise.all(
        movies.map(async (movieData) => {
          try {
            const existingMovie = await this.movieRepository.findOne({
              where: { original_id: movieData.id },
              relations: ['genres', 'spoken_languages', 'original_language'],
            });
            if (existingMovie) {
              if (
                existingMovie.original_language.iso_639_1 !== language.iso_639_1
              ) {
                await this.alternativeTitleService.importAlternativeTitles(
                  existingMovie.id,
                  [
                    {
                      title: movieData.title,
                      iso_639_1: language.iso_639_1,
                      type: 'translation',
                    },
                  ],
                );
                const hasLanguage = existingMovie.spoken_languages.some(
                  (lang) => lang.iso_639_1 === language.iso_639_1,
                );
                if (!hasLanguage) {
                  existingMovie.spoken_languages.push(language);
                  await this.movieRepository.save(existingMovie);
                }
                return null;
              }
              return null;
            }
            const [poster, backdrop] = await Promise.all([
              movieData.poster_path
                ? this.processMovieImage(
                    this.dataSource.manager,
                    `https://image.tmdb.org/t/p/original${movieData.poster_path}`,
                    movieData.title,
                  )
                : null,
              movieData.backdrop_path
                ? this.processMovieImage(
                    this.dataSource.manager,
                    `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`,
                    movieData.title,
                  )
                : null,
            ]);
            const movieGenres =
              movieData.genre_ids
                ?.map((id: number) => genreMap.get(id))
                .filter((g): g is Genre => !!g) || [];
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
              original_id: movieData.id,
            });
          } catch (error) {
            console.error(`Failed to process movie ${movieData.title}:`, error);
            return null;
          }
        }),
      );
      const validMovies = processedMovies.filter(
        (movie): movie is Movie => movie !== null,
      );
      if (validMovies.length > 0) {
        return this.movieRepository.save(validMovies);
      }
      return [];
    } catch (error) {
      console.error('Failed to save movie batch:', error);
      return [];
    }
  }

  private async fetchAlternativeTitlesAndOverviews(movieId: number): Promise<{
    titles: { title: string; iso_639_1: string; type?: string }[];
    overviews: { movieId: string; overview: string; iso_639_1: string }[];
  }> {
    try {
      const results: { title: string; iso_639_1: string; type?: string }[] = [];
      const overviews: {
        movieId: string;
        overview: string;
        iso_639_1: string;
      }[] = [];
      const altTitlesResponse = await api.get<{
        titles?: Array<{ iso_3166_1?: string; title?: string; type?: string }>;
      }>(`/movie/${movieId}/alternative_titles`);
      if (
        altTitlesResponse.data &&
        altTitlesResponse.data.titles &&
        altTitlesResponse.data.titles.length
      ) {
        const existedLanguageCodes: string[] = [];
        for (const title of altTitlesResponse.data.titles) {
          if (title.iso_3166_1 && title.title) {
            const languageCode = getLanguageFromCountry(title.iso_3166_1);
            if (existedLanguageCodes.includes(languageCode)) {
              continue;
            }
            existedLanguageCodes.push(languageCode);
            results.push({
              title: title.title,
              iso_639_1: languageCode,
              type: title.type || 'alternative',
            });
            try {
              const movieDetails = await api.get<{ overview?: string }>(
                `/movie/${movieId}`,
                { params: { language: languageCode } },
              );
              if (movieDetails.data && movieDetails.data.overview) {
                overviews.push({
                  movieId: String(movieId),
                  overview: movieDetails.data.overview,
                  iso_639_1: languageCode,
                });
              }
            } catch (error) {
              console.error(
                `Error fetching movie details for locale ${languageCode}:`,
                error,
              );
            }
          }
        }
      }
      return { titles: results, overviews };
    } catch (error) {
      console.error(
        `Error fetching alternative titles and overviews for movie ${movieId}:`,
        error,
      );
      return { titles: [], overviews: [] };
    }
  }

  async importAlternativeTitlesFromTMDB(movieId: string, tmdbId: number) {
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      select: ['id', 'title', 'original_id'],
    });
    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }
    const fetchedData = await this.fetchAlternativeTitlesAndOverviews(tmdbId);
    if (fetchedData.titles.length === 0) {
      return {
        message: 'No alternative titles or overviews found for this movie',
      };
    }
    const alternativeTitles: {
      title: string;
      iso_639_1: string;
      type?: string;
    }[] = [];
    const alternativeOverviews: { overview: string; iso_639_1: string }[] = [];
    for (let i = 0; i < fetchedData.titles.length; i++) {
      const titleItem = fetchedData.titles[i];
      const overviewItem = fetchedData.overviews[i];
      if (titleItem.title) {
        alternativeTitles.push({
          title: titleItem.title,
          iso_639_1: titleItem.iso_639_1,
          type: titleItem.type,
        });
      }
      if (overviewItem.overview) {
        alternativeOverviews.push({
          overview: overviewItem.overview,
          iso_639_1: overviewItem.iso_639_1,
        });
      }
    }
    const savedTitles =
      await this.alternativeTitleService.importAlternativeTitles(
        movieId,
        alternativeTitles,
      );
    const savedOverviews: AlternativeOverview[] = [];
    for (const overview of alternativeOverviews) {
      if (overview.overview && overview.iso_639_1) {
        const savedOverview =
          await this.alternativeOverviewService.saveAlternativeOverview(
            movieId,
            overview.overview,
            overview.iso_639_1,
          );
        savedOverviews.push(savedOverview);
      }
    }
    return {
      message: `Successfully imported ${savedTitles.length} alternative titles and ${savedOverviews.length} alternative overviews`,
      titles: savedTitles,
      overviews: savedOverviews,
    };
  }

  async updateMovieWithAlternativeTitles(movieId: string) {
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      select: ['id', 'title', 'original_id'],
    });
    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }
    const tmdbId = movie.original_id;
    if (!tmdbId) {
      return { success: false, message: 'No TMDB ID found for this movie' };
    }
    const fetchedData = await this.fetchAlternativeTitlesAndOverviews(tmdbId);
    if (fetchedData.titles.length === 0) {
      return {
        success: true,
        message: 'No alternative titles or overviews found for this movie',
        count: { titles: 0, overviews: 0 },
      };
    }
    const alternativeTitles: {
      title: string;
      iso_639_1: string;
      type?: string;
    }[] = [];
    const alternativeOverviews: { overview: string; iso_639_1: string }[] = [];
    for (let i = 0; i < fetchedData.titles.length; i++) {
      const titleItem = fetchedData.titles[i];
      const overviewItem = fetchedData.overviews[i];
      if (titleItem.title) {
        alternativeTitles.push({
          title: titleItem.title,
          iso_639_1: titleItem.iso_639_1,
          type: titleItem.type,
        });
      }
      if (overviewItem.overview) {
        alternativeOverviews.push({
          overview: overviewItem.overview,
          iso_639_1: overviewItem.iso_639_1,
        });
      }
    }
    const existingTitles =
      await this.alternativeTitleService.findAllByMovieId(movieId);
    if (existingTitles.length > 0) {
      for (const title of existingTitles) {
        await this.alternativeTitleService.remove(title.id);
      }
    }
    const existingOverviews =
      await this.alternativeOverviewService.findAllByMovieId(movieId);
    if (existingOverviews.length > 0) {
      for (const overview of existingOverviews) {
        await this.alternativeOverviewService.remove(overview.id);
      }
    }
    const savedTitles =
      await this.alternativeTitleService.importAlternativeTitles(
        movieId,
        alternativeTitles,
      );
    const savedOverviews: AlternativeOverview[] = [];
    for (const overview of alternativeOverviews) {
      if (overview.overview && overview.iso_639_1) {
        const savedOverview =
          await this.alternativeOverviewService.saveAlternativeOverview(
            movieId,
            overview.overview,
            overview.iso_639_1,
          );
        savedOverviews.push(savedOverview);
      }
    }
    return {
      success: true,
      message: `Successfully updated movie with ${savedTitles.length} alternative titles and ${savedOverviews.length} alternative overviews`,
      count: { titles: savedTitles.length, overviews: savedOverviews.length },
      titles: savedTitles,
      overviews: savedOverviews,
    };
  }

  async importAlternativeTitlesAndOverviews(movieId: string, tmdbId: number) {
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      select: ['id', 'title', 'original_id'],
    });
    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }
    const { titles, overviews } =
      await this.fetchAlternativeTitlesAndOverviews(tmdbId);
    if (titles.length === 0 && overviews.length === 0) {
      return {
        message: 'No alternative titles or overviews found for this movie',
      };
    }
    const savedTitles =
      await this.alternativeTitleService.importAlternativeTitles(
        movieId,
        titles,
      );
    const savedOverviews: AlternativeOverview[] = [];
    for (const overview of overviews) {
      if (overview.overview && overview.iso_639_1) {
        const savedOverview =
          await this.alternativeOverviewService.saveAlternativeOverview(
            movieId,
            overview.overview,
            overview.iso_639_1,
          );
        savedOverviews.push(savedOverview);
      }
    }
    return {
      message: `Successfully imported ${savedTitles.length} alternative titles and ${savedOverviews.length} alternative overviews`,
      titles: savedTitles,
      overviews: savedOverviews,
    };
  }

  // ==================== New TMDB Imports ====================
  async importExternalIds(movie: Movie, tmdbId: number): Promise<Movie> {
    const { data } = await api.get<{
      imdb_id?: string;
      wikidata_id?: string;
      facebook_id?: string;
      instagram_id?: string;
      twitter_id?: string;
    }>(`/movie/${tmdbId}/external_ids`);
    movie.imdb_id = data.imdb_id ?? movie.imdb_id;
    movie.wikidata_id = data.wikidata_id ?? movie.wikidata_id;
    movie.facebook_id = data.facebook_id ?? movie.facebook_id;
    movie.instagram_id = data.instagram_id ?? movie.instagram_id;
    movie.twitter_id = data.twitter_id ?? movie.twitter_id;
    return this.movieRepository.save(movie);
  }

  async importKeywords(movie: Movie, tmdbId: number): Promise<Keyword[]> {
    const { data } = await api.get<{
      keywords: { id: number; name: string }[];
    }>(`/movie/${tmdbId}/keywords`);
    const keywords: Keyword[] = [];
    for (const kw of data.keywords ?? []) {
      let entity = await this.keywordRepository.findOne({
        where: { original_id: kw.id },
      });
      if (!entity) {
        entity = this.keywordRepository.create({
          original_id: kw.id,
          name: kw.name,
        });
        entity = await this.keywordRepository.save(entity);
      }
      keywords.push(entity);
    }
    movie.keywords = Array.from(
      new Set([...(movie.keywords ?? []), ...keywords]),
    );
    await this.movieRepository.save(movie);
    return keywords;
  }

  async importCredits(
    movie: Movie,
    tmdbId: number,
  ): Promise<{ cast: MovieCast[]; crew: MovieCrew[] }> {
    const { data } = await api.get<{
      cast: Array<{
        id: number;
        name: string;
        character?: string;
        order?: number;
        profile_path?: string;
      }>;
      crew: Array<{
        id: number;
        name: string;
        department?: string;
        job?: string;
        profile_path?: string;
      }>;
    }>(`/movie/${tmdbId}/credits`);
    const castSaved: MovieCast[] = [];
    const crewSaved: MovieCrew[] = [];
    // Clear existing
    await this.movieCastRepository.delete({ movie: { id: movie.id } });
    await this.movieCrewRepository.delete({ movie: { id: movie.id } });

    const ensurePerson = async (p: {
      id: number;
      name: string;
      profile_path?: string;
    }): Promise<Person> => {
      let person = await this.personRepository.findOne({
        where: { original_id: p.id },
      });
      if (!person) {
        person = this.personRepository.create({
          original_id: p.id,
          name: p.name,
          profile_url: p.profile_path
            ? `https://image.tmdb.org/t/p/w300${p.profile_path}`
            : undefined,
        });
        person = await this.personRepository.save(person);
      }
      return person;
    };

    for (const c of (data.cast ?? []).slice(0, 15)) {
      const person = await ensurePerson(c);
      const entity = this.movieCastRepository.create({
        movie: { id: movie.id },
        person,
        character: c.character,
        order: c.order,
      });
      castSaved.push(await this.movieCastRepository.save(entity));
    }

    for (const cw of data.crew ?? []) {
      // Focus on directors and writers primarily
      if (!cw.department) continue;
      const person = await ensurePerson(cw);
      const entity = this.movieCrewRepository.create({
        movie: { id: movie.id },
        person,
        department: cw.department,
        job: cw.job,
      });
      crewSaved.push(await this.movieCrewRepository.save(entity));
    }

    return { cast: castSaved, crew: crewSaved };
  }

  async importTranslations(
    movie: Movie,
    tmdbId: number,
  ): Promise<{ overviews: number; taglines: number }> {
    const { data } = await api.get<{
      translations: Array<{
        iso_3166_1: string;
        iso_639_1: string;
        data: { overview?: string; tagline?: string };
      }>;
    }>(`/movie/${tmdbId}/translations`);
    let overviewCount = 0;
    let taglineCount = 0;
    // Clear taglines only (overviews handled via service)
    await this.alternativeTaglineRepository.delete({
      movie: { id: movie.id },
    });
    for (const t of data.translations ?? []) {
      const lang = t.iso_639_1;
      if (t.data?.overview) {
        await this.alternativeOverviewService.saveAlternativeOverview(
          movie.id,
          t.data.overview,
          lang,
        );
        overviewCount++;
      }
      if (t.data?.tagline) {
        const tag = this.alternativeTaglineRepository.create({
          movie: { id: movie.id },
          iso_639_1: lang,
          tagline: t.data.tagline,
        });
        await this.alternativeTaglineRepository.save(tag);
        taglineCount++;
      }
    }
    return { overviews: overviewCount, taglines: taglineCount };
  }

  async importWatchProviders(
    movie: Movie,
    tmdbId: number,
    region: string = 'US',
  ) {
    const { data } = await api.get<{
      results: Record<
        string,
        import('../../watch-provider/watch-provider.dto').MovieWatchProviderApiResponseDto
      >;
    }>(`/movie/${tmdbId}/watch/providers`);
    const regionData = data.results?.[region];
    if (!regionData) return [];
    return this.movieWatchProviderService.syncWatchProvidersForMovie(
      { movieId: movie.id, originalMovieId: tmdbId, region },
      regionData,
    );
  }

  /**
   * High-level: crawl and enrich a movie by TMDB id
   */
  async crawlFullMovieByTMDBId(tmdbId: number, region: string = 'US') {
    // Ensure movie exists or create skeleton
    let movie = await this.movieRepository.findOne({
      where: { original_id: tmdbId },
      relations: [
        'keywords',
        'cast',
        'crew',
        'alternative_overviews',
        'alternative_titles',
      ],
    });
    if (!movie) {
      const { data } = await api.get<TMDBMovieDetails>(`/movie/${tmdbId}`);
      const language = await this.languageService.findOrCreate({
        iso_639_1: data.original_language,
      });
      const poster = data.poster_path
        ? await this.processMovieImage(
            this.dataSource.manager,
            `https://image.tmdb.org/t/p/original${data.poster_path}`,
            data.title,
          )
        : null;
      const backdrop = data.backdrop_path
        ? await this.processMovieImage(
            this.dataSource.manager,
            `https://image.tmdb.org/t/p/original${data.backdrop_path}`,
            data.title,
          )
        : null;
      // Genres by TMDB ids -> find existing
      const genres: Genre[] = [];
      for (const g of data.genres ?? []) {
        const found = await this.genreRepository.findOne({
          where: { original_id: g.id },
        });
        if (found) genres.push(found);
      }
      const createPayload: DeepPartial<Movie> = {
        title: data.title,
        original_title: data.original_title,
        overview: data.overview,
        release_date: data.release_date,
        original_language: language,
        spoken_languages: [language],
        genres,
        original_id: tmdbId,
        popularity: data.popularity ?? 0,
        vote_average: data.vote_average ?? 0,
        vote_count: data.vote_count ?? 0,
      };
      if (poster) createPayload.poster = poster;
      if (backdrop) createPayload.backdrop = backdrop;
      if (data.runtime != null) createPayload.runtime = data.runtime;
      if (data.status != null)
        createPayload.status = mapTmdbStatusToMovieStatus(data.status);
      if (data.tagline != null) createPayload.tagline = data.tagline;

      movie = this.movieRepository.create(createPayload);
      movie = await this.movieRepository.save(movie);
    }

    // Enrich
    await this.importExternalIds(movie, tmdbId);
    await this.importKeywords(movie, tmdbId);
    await this.importCredits(movie, tmdbId);
    await this.importTranslations(movie, tmdbId);
    await this.importWatchProviders(movie, tmdbId, region);

    return await this.movieRepository.findOne({
      where: { id: movie.id },
      relations: ['genres', 'keywords', 'cast', 'crew', 'videos'],
    });
  }
}

type TMDBDiscoverMovie = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path?: string;
  backdrop_path?: string;
  genre_ids: number[];
};

type ImageProbe = { width: number; height: number; length: number };

// Subset of TMDB Movie Details response we actually use
type TMDBMovieDetails = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  original_language: string;
  genres?: Array<{ id: number; name: string }>;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  runtime?: number | null;
  status?: string | null;
  tagline?: string | null;
};
