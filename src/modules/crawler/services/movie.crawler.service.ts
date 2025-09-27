import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Movie } from '../../movie/entities/movie.entity';
import { Genre } from '../../genre/genre.entity';
import { GenreCrawlerService } from './genre.crawler.service';
import { LanguageCrawlerService } from './language.crawler.service';
import { Language } from '../../language/language.entity';
import api from '@/common/utils/axios.util';
import { modelNames } from '@/common/constants/model-name.constant';
import { getLanguageFromCountry } from '@/common/utils/locale.util';
import { processMovieImages } from './crawler.utils';
import { CreditsCrawlerService } from './credits.crawler.service';
import { TMDBMovieDetails, TMDBMovieImage } from '../dtos/movie.dto';

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
    private readonly genreCrawlerService: GenreCrawlerService,
    private readonly languageCrawlerService: LanguageCrawlerService,
    private readonly creditsCrawlerService: CreditsCrawlerService,
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
      const topLanguages =
        await this.languageCrawlerService.initializeLanguagesInBatches();
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
        const genreMap =
          await this.genreCrawlerService.initializeGenresForLanguage(language);
        console.log(
          `✅ Processed ${genreMap.size} genres for ${language.name}`,
        );
        genreMapByLanguage.set(language.iso_639_1, genreMap);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log('Step 4: Processing movies for each language...');
      const pagesToFetch = 5;
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
                genre_ids: number[];
                backdrops: TMDBMovieImage[];
                posters: TMDBMovieImage[];
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
              const moviesDetailsPromises = await Promise.all(
                batch.map(async (movie) => {
                  return {
                    ...(
                      await api.get<TMDBMovieDetails>(`/movie/${movie.id}`, {
                        params: {
                          language: language.iso_639_1,
                          append_to_response: 'credits,videos',
                        },
                      })
                    ).data,
                    ...(
                      await api.get<{
                        backdrops: TMDBMovieImage[];
                        posters: TMDBMovieImage[];
                      }>(`/movie/${movie.id}/images`, {
                        params: { language: language.iso_639_1 },
                      })
                    ).data,
                  };
                }),
              );
              console.log(
                `    🎬 Processing batch of movies ${batchStart}-${batchEnd}/${data.results.length}...`,
              );
              try {
                const savedBatchMovie = await this.processMovieBatch(
                  moviesDetailsPromises,
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

  private async processMovieBatch(
    movies: TMDBMovieDetails[],
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
              return null;
            }
            const [posters, backdrops] = await Promise.all([
              movieData.posters
                ? processMovieImages(
                  this.dataSource.manager,
                  movieData.posters,
                  movieData.title,
                )
                : null,
              movieData.backdrops
                ? processMovieImages(
                  this.dataSource.manager,
                  movieData.backdrops,
                  movieData.title,
                )
                : null,
            ]);
            const movieGenres =
              movieData.genres
                ?.map((g: { id: number; name: string }) => genreMap.get(g.id))
                .filter((g): g is Genre => !!g) || [];
            const newMovie = this.movieRepository.create({
              title: movieData.title,
              original_title: movieData.original_title,
              overview: movieData.overview,
              release_date: movieData.release_date,
              spoken_languages: [language],
              original_language: language,
              posters: posters || undefined,
              backdrops: backdrops || undefined,
              genres: movieGenres,
              original_id: movieData.id,
            });
            await this.creditsCrawlerService.importCreditsWithoutFetching(
              newMovie,
              movieData.credits.cast,
              movieData.credits.crew,
            );
            return newMovie;
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
}