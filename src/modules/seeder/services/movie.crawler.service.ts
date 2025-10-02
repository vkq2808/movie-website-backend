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
import { processMovieImages } from './crawler.utils';
import { CreditsCrawlerService } from './credits.crawler.service';
import { MovieBatch, TMDBMovieDetails, TMDBMovieImage } from '../dtos/movie.dto';
import pLimit from 'p-limit';
import { ProductionCompanyCrawlerService } from './production-company.crawler.service';
import { LanguageService } from '@/modules/language/language.service';

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
    private readonly languageService: LanguageService,
    private readonly creditsCrawlerService: CreditsCrawlerService,
    private readonly productionCompanyCrawlerService: ProductionCompanyCrawlerService,
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
      await this.languageCrawlerService.crawlAllLanguages();
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
      }

      console.log('Step 4: Processing movies for each language...');
      const pagesToFetch = 200;
      const pageOffset = 1;
      let totalMoviesFetched = 0;
      let totalMoviesSaved = 0;

      for (const language of topLanguages) {
        for (const country of ['US', 'JP', 'KR', 'CN']) {

          console.log(
            `\n📽️ Processing movies for country: ${country}...`,
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

          const PAGE_CONCURRENCY = 5;   // how many pages to fetch in parallel
          const BATCH_CONCURRENCY = 4;  // how many batches per page to run in parallel
          const BATCH_SIZE = 5;

          const pageLimit = pLimit(PAGE_CONCURRENCY);

          const pageTasks: Promise<void>[] = [];

          for (let page = pageOffset; page <= totalPages; page++) {
            pageTasks.push(
              pageLimit(async () => {
                console.log(`\n🔄 Processing page ${page}/${totalPages} for ${language.name}...`);

                try {
                  const { data } = await api.get<{
                    total_pages: number;
                    results: Array<TMDBMovieDetails>;
                  }>('/discover/movie', { params: { ...params, page, with_origin_country: country } });

                  console.log(`📋 Found ${data.results.length} movies on page ${page}`);

                  const batchLimit = pLimit(BATCH_CONCURRENCY);
                  const batchTasks: Promise<void>[] = [];

                  for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
                    const batch = data.results.slice(i, i + BATCH_SIZE);
                    const batchStart = i + 1;
                    const batchEnd = Math.min(i + BATCH_SIZE, data.results.length);

                    batchTasks.push(
                      batchLimit(async () => {
                        console.log(`🎬 Page ${page}: processing movies ${batchStart}-${batchEnd}/${data.results.length}`);
                        try {
                          const moviesDetailsPromises = await Promise.all(
                            batch.map(async (movie) => {
                              // Fetch detailed movie info and images first
                              const detailsResp = await api.get<TMDBMovieDetails>(`/movie/${movie.id}`, {
                                params: {
                                  language: language.iso_639_1,
                                  append_to_response: 'credits,videos',
                                },
                              });
                              const imagesResp = await api.get<{ backdrops: TMDBMovieImage[]; posters: TMDBMovieImage[] }>(
                                `/movie/${movie.id}/images`,
                                { params: { language: language.iso_639_1 } }
                              );

                              // Use production_companies from the detailed response (not the discover item)
                              const detailData = detailsResp.data;
                              const imageData = imagesResp.data;
                              let productionCompanyIds = (detailData.production_companies || []).map(pc => String(pc.id));
                              if (imageData.backdrops.length === 0 || imageData.posters.length === 0) {
                                productionCompanyIds = []; // Skip importing production companies if no images
                              }

                              return {
                                ...detailData,
                                ...imageData,
                                production_companies: await this.productionCompanyCrawlerService.importProductionCompaniesByIds(
                                  productionCompanyIds,
                                ),
                              };
                            })
                          );

                          const filteredMoviesDetailsPromises = moviesDetailsPromises.filter(
                            (movie) => movie.backdrops.length > 0 && movie.posters.length > 0,
                          );

                          const savedBatchMovie = await this.processMovieBatch(
                            filteredMoviesDetailsPromises,
                            language,
                            genreMap
                          );

                          totalMoviesFetched += batch.length;
                          totalMoviesSaved += savedBatchMovie.length;
                        } catch (error) {
                          console.error(`❌ Error processing page ${page} batch:`, error);
                        }
                      })
                    );
                  }

                  await Promise.all(batchTasks);
                } catch (error) {
                  console.error(`❌ Error fetching page ${page} for ${language.name}:`, error);
                }
              })
            );
          }
          // Run all pages (with concurrency control)
          await Promise.all(pageTasks);
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
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.IMAGE}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE_CAST}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE_CREW}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE_GENRES}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE_SPOKEN_LANGUAGE}" CASCADE`)
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.PERSON}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.GENRE}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.LANGUAGE}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.MOVIE_PRODUCTION_COMPANIES}" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "${modelNames.PRODUCTION_COMPANY}" CASCADE`);
  }

  private async processMovieBatch(
    movies: MovieBatch[],
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
              console.log(`Movie "${movieData.title}" already exists, skipping.`);
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
                .map((g: { id: number; name: string }) => genreMap.get(g.id))
                .filter((g): g is Genre => g != undefined) || [];
            const spokenLanguages = await Promise.all(
              movieData.spoken_languages.map(async (lang) => {
                return this.languageService.findOrCreate({ iso_639_1: lang.iso_639_1 });
              })
            );
            const newMovie = this.movieRepository.create({
              title: movieData.title,
              original_title: movieData.original_title,
              overview: movieData.overview,
              release_date: movieData.release_date,
              spoken_languages: spokenLanguages || [],
              original_language: await this.languageService.findByIsoCode(
                movieData.original_language,
              ) || language,
              popularity: movieData.popularity,
              vote_average: movieData.vote_average,
              vote_count: movieData.vote_count,
              // attach imported production companies (if any)
              production_companies: movieData.production_companies || undefined,
              posters: posters || undefined,
              backdrops: backdrops || undefined,
              genres: movieGenres,
              original_id: movieData.id
            });
            const savedMovie = await this.movieRepository.save(newMovie);
            return this.creditsCrawlerService.importCreditsWithoutFetching(savedMovie, movieData.credits.cast, movieData.credits.crew)
          } catch (error) {
            console.error(`Failed to process movie ${movieData.title}:`, error);
            return null;
          }
        }),
      );
      const validMovies = processedMovies.filter(
        (movie): movie is Movie => movie !== null,
      );
      return validMovies;
    } catch (error) {
      console.error('Failed to save movie batch:', error);
      return [];
    }
  }
}