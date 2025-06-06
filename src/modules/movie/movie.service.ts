// filepath: c:\Users\Administrator\Desktop\code\be\src\modules\movie\movie.service.ts
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

/**
 * Common parameters for movie discovery from TMDB API
 */
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
    private dataSource: DataSource
  ) {
    // this.fetchAllMoviesToDatabase();
  }

  // =====================================================
  // CORE MOVIE CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new movie with language integration
   * @param movieData Movie data to create
   * @returns Created movie entity
   */
  async createMovie(
    movieData: Partial<Movie> & { languageIsoCode?: string }
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
   * @param movieData Movie data to update
   * @returns Updated movie entity
   */
  async updateMovie(
    id: string,
    movieData: Partial<Movie> & { languageIsoCode: string }
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
        (lang) => lang.iso_639_1 === language.iso_639_1
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
    return this.movieRepository.save(movie);
  }

  // =====================================================
  // MOVIE RETRIEVAL METHODS
  // =====================================================

  /**
   * getMovieById using separate queries
   * @param id Movie UUID
   * @param includeAlternatives Whether to include alternative titles and overviews
   * @returns Movie details with optional alternative content
   */
  async getMovieById(
    id: string,
    includeAlternatives: boolean = true
  ): Promise<Movie> {
    // Step 1: Get basic movie data with essential relations
    const movie = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.poster', 'poster')
      .leftJoinAndSelect('movie.backdrop', 'backdrop')
      .leftJoinAndSelect('movie.original_language', 'original_language')
      .where('movie.id = :id', { id })
      .getOne();

    if (!movie) {
      throw new Error(`Movie with ID ${id} not found`);
    }

    // Step 2: Get genres separately
    movie.genres = await this.movieRepository
      .createQueryBuilder('movie')
      .relation('genres')
      .of(id)
      .loadMany();

    // Step 3: Get spoken languages separately
    movie.spoken_languages = await this.movieRepository
      .createQueryBuilder('movie')
      .relation('spoken_languages')
      .of(id)
      .loadMany();

    // Step 4: Get production companies separately
    movie.production_companies = await this.movieRepository
      .createQueryBuilder('movie')
      .relation('production_companies')
      .of(id)
      .loadMany();

    if (includeAlternatives) {
      // Step 5: Get alternative titles
      movie.alternative_titles = await this.alternativeTitleService.findAllByMovieId(id);

      // Step 6: Get alternative overviews
      movie.alternative_overviews = await this.alternativeOverviewService.findAllByMovieId(id);
    }

    return movie;
  }

  /**
   * Get movies with dynamic filtering based on query parameters
   * @param filters Object containing various filter parameters
   * @param page Page number (starting from 1)
   * @param limit Number of movies per page
   * @returns Paginated list of movies with applied filters
   */
  async getMovies(
    filters: Record<string, any> = {},
    page = 1,
    limit = 10
  ) {
    // Calculate offset
    const offset = (page - 1) * limit;

    // Start building the query with basic movie data
    const queryBuilder = this.movieRepository.createQueryBuilder('movie');

    // Track which joins have been added to avoid duplicates
    const addedJoins = new Set<string>();

    // Helper function to add joins only when needed
    const addJoinIfNeeded = (joinName: string, joinPath: string, alias: string) => {
      if (!addedJoins.has(joinName)) {
        queryBuilder.leftJoinAndSelect(joinPath, alias);
        addedJoins.add(joinName);
      }
    };

    // Always load essential relations for better UX
    const alwaysLoadRelations = ['poster', 'backdrop', 'genres'];
    alwaysLoadRelations.forEach(relation => {
      addJoinIfNeeded(relation, `movie.${relation}`, relation);
    });

    // Apply dynamic filters and add joins as needed
    this.applyFilters(queryBuilder, filters, addJoinIfNeeded);

    // Apply ordering
    this.applyOrdering(queryBuilder, filters);

    // Apply pagination
    queryBuilder.skip(offset).take(limit);

    // Execute query
    const [movies, totalCount] = await queryBuilder.getManyAndCount();

    // Get alternative titles for the movies
    const movieIds = movies.map(m => m.id);
    const allTitles = movieIds.length > 0
      ? await this.alternativeTitleService.findAllByMovieIds(movieIds)
      : [];

    // Create a map of movie ID to titles for O(1) lookup
    const titlesByMovieId = this.groupByMovieId(allTitles);

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
        appliedFilters: filters,
      },
    };
  }

  /**
   * Get slides for homepage with optional language filtering
   * @param languageCode Optional language code for filtering
   * @param limit Number of slides to return
   * @returns Array of movie slides with alternative content
   */
  async getSlides(languageCode?: string, limit: number = 5) {
    const movies = await this.movieRepository
      .createQueryBuilder('movie')
      .innerJoinAndSelect('movie.genres', 'genre')
      .innerJoinAndSelect('movie.poster', 'poster')
      .innerJoinAndSelect('movie.backdrop', 'backdrop')
      .orderBy('movie.popularity', 'DESC')
      .take(limit)
      .getMany();

    if (!movies.length) {
      return [];
    }

    const movieIds = movies.map(m => m.id);    // Use optimized methods with language filtering if provided
    const [allTitles, allOverviews] = await Promise.all([
      languageCode
        ? this.alternativeTitleService.findAllByMovieIdsWithLanguage(movieIds, languageCode)
        : this.alternativeTitleService.findAllByMovieIds(movieIds),
      languageCode
        ? this.alternativeOverviewService.findAllByMovieIdsWithLanguage(movieIds, languageCode)
        : this.alternativeOverviewService.findAllByMovieIds(movieIds)
    ]);

    // Create optimized maps for O(1) lookup
    const titlesByMovieId = this.groupByMovieId(allTitles);
    const overviewsByMovieId = this.groupByMovieId(allOverviews);

    return movies.map((movie) => ({
      ...movie,
      alternative_titles: (titlesByMovieId.get(movie.id) || []).map(title => ({
        title: title.title,
        iso_639_1: title.iso_639_1
      })),
      alternative_overviews: (overviewsByMovieId.get(movie.id) || []).map(overview => ({
        overview: overview.overview,
        iso_639_1: overview.iso_639_1
      }))
    }));
  }

  // =====================================================
  // LANGUAGE MANAGEMENT
  // =====================================================

  /**
   * Add a language to a movie
   * @param movieId Movie ID
   * @param languageIsoCode ISO 639-1 language code
   * @returns Updated movie with added language
   */
  async addLanguageToMovie(movieId: string, languageIsoCode: string): Promise<Movie> {
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
      (lang) => lang.iso_639_1 === languageIsoCode
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
  async removeLanguageFromMovie(movieId: string, languageIsoCode: string): Promise<Movie> {
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
      (lang) => lang.iso_639_1 !== languageIsoCode
    );

    // Save the updated movie
    return this.movieRepository.save(movie);
  }

  // =====================================================
  // ALTERNATIVE TITLES MANAGEMENT
  // =====================================================

  /**
   * Get alternative titles for a specific movie
   * @param movieId Movie UUID
   * @returns Array of alternative titles
   */
  async getAlternativeTitles(movieId: string) {
    return this.alternativeTitleService.findAllByMovieId(movieId);
  }

  /**
   * Import alternative titles for a movie from TMDB
   * @param movieId Movie UUID
   * @param tmdbId TMDB movie ID
   * @returns Array of imported alternative titles
   */
  async importAlternativeTitlesFromTMDB(movieId: string, tmdbId: number) {
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      select: ['id', 'title', 'original_id']
    });

    if (!movie) {
      throw new Error(`Movie with ID ${movieId} not found`);
    }

    const alternativeTitles = await this.fetchAlternativeTitles(tmdbId);

    if (alternativeTitles.length === 0) {
      return { message: 'No alternative titles found for this movie' };
    }

    const savedTitles = await this.alternativeTitleService.importAlternativeTitles(
      movieId,
      alternativeTitles
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
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
      select: ['id', 'title', 'original_id']
    });

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
    }

    // Fetch alternative titles from TMDB
    const alternativeTitles = await this.fetchAlternativeTitles(tmdbId);

    if (alternativeTitles.length === 0) {
      return {
        success: true,
        message: 'No alternative titles found for this movie',
        count: 0,
      };
    }

    // Delete existing alternative titles for this movie to avoid duplicates
    const existingTitles = await this.alternativeTitleService.findAllByMovieId(movieId);

    if (existingTitles.length > 0) {
      for (const title of existingTitles) {
        await this.alternativeTitleService.remove(title.id);
      }
    }

    // Import new alternative titles
    const savedTitles = await this.alternativeTitleService.importAlternativeTitles(
      movieId,
      alternativeTitles
    );

    return {
      success: true,
      message: `Successfully updated movie with ${savedTitles.length} alternative titles`,
      count: savedTitles.length,
      titles: savedTitles,
    };
  }

  // =====================================================
  // BULK IMPORT OPERATIONS
  // =====================================================

  /**
   * Fetch all movies from TMDB and import to database
   */
  async fetchAllMoviesToDatabase() {
    console.log('========== START: Fetching all movies from TMDB ==========');
    console.time('Total import time');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Step 1: Clear existing data
      console.log('Step 1: Clearing existing data...');
      await this.clearExistingData(queryRunner);
      console.log('✅ Existing data cleared successfully');

      // Step 2: Initialize languages in batches
      console.log('Step 2: Initializing languages in batches...');
      const topLanguages = await this.initializeLanguagesInBatches();
      console.log(`✅ Initialized ${topLanguages.length} languages`);

      if (!topLanguages.length) {
        throw new Error('Failed to initialize languages');
      }

      // Step 3: Fetch and process genres for each language
      console.log('Step 3: Fetching and processing genres for each language...');
      const genreMapByLanguage = new Map<string, Map<number, Genre>>();

      for (const language of topLanguages) {
        console.log(`Processing genres for language: ${language.name} (${language.iso_639_1})...`);
        const genreMap = await this.initializeGenresForLanguage(language);
        console.log(`✅ Processed ${genreMap.size} genres for ${language.name}`);
        genreMapByLanguage.set(language.iso_639_1, genreMap);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }

      // Step 4: Process movies for each language
      console.log('Step 4: Processing movies for each language...');
      const pagesToFetch = 3;
      let totalMoviesFetched = 0;
      let totalMoviesSaved = 0;

      for (const language of topLanguages) {
        console.log(`\n📽️ Processing movies for language: ${language.name} (${language.iso_639_1})...`);
        const params = {
          ...baseParams,
          language: language.iso_639_1,
        };

        // Get total pages for this language
        console.log(`Fetching page information for ${language.name}...`);
        const firstPage = await api.get('/discover/movie', {
          params: { ...params, page: 1 },
        });
        const totalPagesAvailable = firstPage.data.total_pages;
        const totalPages = Math.min(totalPagesAvailable, pagesToFetch);
        console.log(`Found ${totalPagesAvailable} total pages, will fetch ${totalPages} pages`);

        // Get genre map for current language
        const genreMap = genreMapByLanguage.get(language.iso_639_1);
        if (!genreMap) {
          console.warn(`No genre map found for ${language.name}, skipping...`);
          continue;
        }

        // Process pages in sequence
        for (let page = 1; page <= totalPages; page++) {
          console.log(`\n  🔄 Processing page ${page}/${totalPages} for ${language.name}...`);
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
            }>('/discover/movie', {
              params: { ...params, page },
            });

            console.log(`  📋 Found ${data.results.length} movies on page ${page}`);

            // Process movies in smaller batches
            const BATCH_SIZE = 5;
            for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
              const batch = data.results.slice(i, i + BATCH_SIZE);
              const batchStart = i + 1;
              const batchEnd = Math.min(i + BATCH_SIZE, data.results.length);

              console.log(`    🎬 Processing batch of movies ${batchStart}-${batchEnd}/${data.results.length}...`);

              try {
                const savedBatchMovie = await this.processMovieBatch(batch, language, genreMap);
                totalMoviesFetched += batch.length;
                totalMoviesSaved += savedBatchMovie.length;

                console.log(`    ✅ Saved ${savedBatchMovie.length}/${batch.length} movies from batch`);

                // Process alternative titles only for the first language
                if (language === topLanguages[0] && savedBatchMovie.length > 0) {
                  console.log(`    🔤 Fetching alternative titles for ${savedBatchMovie.length} movies...`);
                  let altTitlesCount = 0;

                  await Promise.all(
                    savedBatchMovie.map(async (movie) => {
                      const alternativeTitles = await this.fetchAlternativeTitles(movie.original_id);
                      if (alternativeTitles.length > 0) {
                        await this.alternativeTitleService.importAlternativeTitles(
                          movie.id,
                          alternativeTitles
                        );
                        altTitlesCount += alternativeTitles.length;
                      }
                    })
                  );

                  console.log(`    ✅ Imported ${altTitlesCount} alternative titles`);
                }
              } catch (error) {
                console.error('    ❌ Error processing movie batch:', error);
                // Log error but continue with next batch
              }

              console.log(`    ⏱️ Rate limiting - waiting 1 second before next batch...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }
          } catch (error) {
            console.error(`  ❌ Error fetching page ${page} for ${language.name}:`, error);
            // Log error but continue with next page
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

  /**
   * Clear existing data in the database
   * @param queryRunner QueryRunner instance
   */
  async clearExistingData(queryRunner: QueryRunner) {
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.ALTERNATIVE_TITLE_MODEL_NAME}" CASCADE`
    );
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.IMAGE_MODEL_NAME}" CASCADE`
    );
    await queryRunner.query(
      `TRUNCATE TABLE "${modelNames.MOVIE_MODEL_NAME}" CASCADE`
    );
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Check image with Globe utility
   * @param url Image URL to check
   * @returns Image probe result or null
   */
  async checkWithGlobe(url: string) {
    const probe = require('probe-image-size');

    try {
      return await probe(url);
    } catch (err) {
      console.error('Error probing image:', err);
      return null;
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Helper method to group items by movie ID
   * @param items Array of items with movie relation
   * @returns Map of movie IDs to items
   */
  private groupByMovieId<T extends { movie: { id: string } }>(items: T[]): Map<string, T[]> {
    const groupedItems = new Map<string, T[]>();

    for (const item of items) {
      if (item?.movie?.id) {
        if (!groupedItems.has(item.movie.id)) {
          groupedItems.set(item.movie.id, []);
        }
        groupedItems.get(item.movie.id)!.push(item);
      }
    }

    return groupedItems;
  }

  /**
   * Apply filters to query builder
   * @param queryBuilder QueryBuilder instance
   * @param filters Filter parameters
   * @param addJoinIfNeeded Function to add joins conditionally
   */
  private applyFilters(
    queryBuilder: any,
    filters: Record<string, any>,
    addJoinIfNeeded: (joinName: string, joinPath: string, alias: string) => void
  ) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        switch (key) {
          case 'language':
            // Add production companies join if needed for language filtering
            addJoinIfNeeded('production_companies', 'movie.production_companies', 'production_company');
            // Filter by production company language
            queryBuilder.andWhere(
              'production_company.iso_639_1 = :language',
              { language: value }
            );
            break;
          case 'genre':
            // Genre join is already added as essential relation
            // Filter by genre name or id
            if (typeof value === 'string') {
              queryBuilder.andWhere(
                '(genre.name ILIKE :genreName OR genre.id = :genreId)',
                { genreName: `%${value}%`, genreId: value }
              );
            } else {
              queryBuilder.andWhere('genre.id = :genreId', { genreId: value });
            }
            break;
          case 'production_company':
            // Add production companies join if needed
            addJoinIfNeeded('production_companies', 'movie.production_companies', 'production_company');
            // Filter by production company name or id
            if (typeof value === 'string') {
              queryBuilder.andWhere(
                '(production_company.name ILIKE :companyName OR production_company.id = :companyId)',
                { companyName: `%${value}%`, companyId: value }
              );
            } else {
              queryBuilder.andWhere('production_company.id = :companyId', { companyId: value });
            }
            break;
          case 'original_language':
            // Add original language join if needed
            addJoinIfNeeded('original_language', 'movie.original_language', 'original_language');
            // Filter by original language specifically
            queryBuilder.andWhere('original_language.iso_639_1 = :originalLanguage', { originalLanguage: value });
            break;
          case 'title':
            // Filter by movie title (case-insensitive partial match)
            queryBuilder.andWhere('movie.title ILIKE :title', { title: `%${value}%` });
            break;
          case 'overview':
            // Filter by overview (case-insensitive partial match)
            queryBuilder.andWhere('movie.overview ILIKE :overview', { overview: `%${value}%` });
            break;
          case 'release_year':
            // Filter by release year
            queryBuilder.andWhere('EXTRACT(year FROM movie.release_date) = :year', { year: value });
            break;
          case 'min_vote_average':
            // Filter by minimum vote average
            queryBuilder.andWhere('movie.vote_average >= :minVote', { minVote: value });
            break;
          case 'max_vote_average':
            // Filter by maximum vote average
            queryBuilder.andWhere('movie.vote_average <= :maxVote', { maxVote: value });
            break;
          case 'min_popularity':
            // Filter by minimum popularity
            queryBuilder.andWhere('movie.popularity >= :minPopularity', { minPopularity: value });
            break;
          case 'max_popularity':
            // Filter by maximum popularity
            queryBuilder.andWhere('movie.popularity <= :maxPopularity', { maxPopularity: value });
            break;
          case 'adult':
            // Filter by adult content
            queryBuilder.andWhere('movie.adult = :adult', { adult: value });
            break;
          case 'status':
            // Filter by movie status
            queryBuilder.andWhere('movie.status = :status', { status: value });
            break;
          default:
            // Log unknown filter parameters but don't break the query
            break;
        }
      }
    });
  }

  /**
   * Apply ordering to query builder
   * @param queryBuilder QueryBuilder instance
   * @param filters Filter parameters containing sort options
   */
  private applyOrdering(queryBuilder: any, filters: Record<string, any>) {
    // Apply ordering (default by popularity descending)
    const sortBy = filters.sort_by || 'popularity';
    const sortOrder = filters.sort_order || 'DESC';

    switch (sortBy) {
      case 'release_date':
        queryBuilder.orderBy('movie.release_date', sortOrder);
        break;
      case 'vote_average':
        queryBuilder.orderBy('movie.vote_average', sortOrder);
        break;
      case 'title':
        queryBuilder.orderBy('movie.title', sortOrder);
        break;
      case 'vote_count':
        queryBuilder.orderBy('movie.vote_count', sortOrder);
        break;
      default:
        queryBuilder.orderBy('movie.popularity', sortOrder);
    }
  }

  /**
   * Initialize languages in batches to avoid overwhelming the database
   * @returns Array of initialized languages
   */
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

  /**
   * Initialize genres for a specific language
   * @param language Language entity
   * @returns Map of genre IDs to Genre entities
   */
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

  /**
   * Process movie image and save to database
   * @param manager Entity manager
   * @param url Image URL
   * @param alt Alt text for image
   * @returns Saved Image entity or null
   */
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

  /**
   * Process a batch of movies from TMDB API
   * @param movies Array of movie data from TMDB
   * @param language Language entity
   * @param genreMap Map of genre IDs to Genre entities
   * @returns Array of processed Movie entities
   */
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
                    iso_639_1: language.iso_639_1,
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
        return this.movieRepository.save(validMovies);
      }
      return [];
    } catch (error) {
      console.error('Failed to save movie batch:', error);
      return [];
    }
  }
  /**
   * Fetch alternative titles from TMDB API
   * @param movieId TMDB movie ID
   * @returns Array of alternative titles with language codes
   */  private async fetchAlternativeTitles(
    movieId: number
  ): Promise<{ title: string; iso_639_1: string; type?: string }[]> {
    try {
      // First, get translations which contain language codes and titles
      const translationsResponse = await api.get(`/movie/${movieId}/translations`);
      const translations: { title: string; iso_639_1: string; type?: string }[] = [];

      if (translationsResponse.data && translationsResponse.data.translations) {
        // Extract titles from translations (these have proper language codes)
        translations.push(...translationsResponse.data.translations
          .filter(t => t.data && t.data.title)
          .map(t => ({
            title: t.data.title,
            iso_639_1: t.iso_639_1,
            type: 'translation'
          }))
        );
      }

      // Also get alternative titles (though these use country codes)
      const altTitlesResponse = await api.get(`/movie/${movieId}/alternative_titles`);

      if (altTitlesResponse.data && altTitlesResponse.data.titles && altTitlesResponse.data.titles.length) {
        // For alternative titles, we need to map country codes to language codes
        // This is an approximation, as TMDB uses country codes for alternative titles
        const countryToLanguageMap = {
          'US': 'en', 'GB': 'en', 'CA': 'en',
          'FR': 'fr', 'DE': 'de', 'ES': 'es',
          'IT': 'it', 'JP': 'ja', 'KR': 'ko',
          'CN': 'zh', 'TW': 'zh', 'RU': 'ru',
          'BR': 'pt', 'PT': 'pt', 'IN': 'hi',
          'SE': 'sv', 'NO': 'no', 'DK': 'da',
          'FI': 'fi', 'NL': 'nl', 'TR': 'tr',
          'PL': 'pl', 'HU': 'hu', 'CZ': 'cs',
          'TH': 'th', 'VN': 'vi'
        };

        translations.push(...altTitlesResponse.data.titles
          .filter(title => title.iso_3166_1 && title.title)
          .map(title => ({
            title: title.title,
            // Use the mapping if available, otherwise use a default (English)
            iso_639_1: countryToLanguageMap[title.iso_3166_1] || 'en',
            type: title.type || 'alternative'
          }))
        );
      }      // Remove duplicates by language+title
      const uniqueTranslations: { title: string; iso_639_1: string; type?: string }[] = [];
      const seen = new Set<string>();

      for (const translation of translations) {
        const key = `${translation.iso_639_1}:${translation.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTranslations.push(translation);
        }
      }

      return uniqueTranslations;
    } catch (error) {
      console.error(`Error fetching alternative titles for movie ${movieId}:`, error);
      return [];
    }
  }
}
