// filepath: c:\Users\Administrator\Desktop\code\be\src\modules\movie\movie.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Movie } from '../entities/movie.entity';
import { Genre } from '../../genre/genre.entity';
import { Image } from '../../image/image.entity';
import { Video } from '../../video/video.entity';
import { AlternativeTitleService } from './alternative-title.service';
import { AlternativeOverviewService } from './alternative-overview.service';
import { Language } from '../../language/language.entity';
import { LanguageService } from '../../language/language.service';

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
    private dataSource: DataSource,
  ) {}

  // =====================================================
  // CORE MOVIE CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new movie with language integration
   * @param movieData Movie data to create
   * @returns Created movie entity
   */
  async createMovie(
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
    const movieWithoutLanguage: Partial<Movie> = { ...movieData };
    delete (movieWithoutLanguage as { languageIsoCode?: string })
      .languageIsoCode;

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
    const updateData: Partial<Movie> = { ...movieData } as Partial<Movie> & {
      languageIsoCode?: string;
    };
    delete (updateData as { languageIsoCode?: string }).languageIsoCode;

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
    includeAlternatives: boolean = true,
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
      movie.alternative_titles =
        await this.alternativeTitleService.findAllByMovieId(id);

      // Step 6: Get alternative overviews
      movie.alternative_overviews =
        await this.alternativeOverviewService.findAllByMovieId(id);
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
  async getMovies(filters: Partial<MovieFilters> = {}, page = 1, limit = 10) {
    // Calculate offset
    const offset = (page - 1) * limit;

    // Start building the query with basic movie data
    const queryBuilder = this.movieRepository.createQueryBuilder('movie');

    // Track which joins have been added to avoid duplicates
    const addedJoins = new Set<string>();

    // Helper function to add joins only when needed
    const addJoinIfNeeded = (
      joinName: string,
      joinPath: string,
      alias: string,
    ) => {
      if (!addedJoins.has(joinName)) {
        queryBuilder.leftJoinAndSelect(joinPath, alias);
        addedJoins.add(joinName);
      }
    };

    // Always load essential relations for better UX
    const alwaysLoadRelations = ['poster', 'backdrop', 'genres'];
    alwaysLoadRelations.forEach((relation) => {
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
    const movieIds = movies.map((m) => m.id);
    const allTitles =
      movieIds.length > 0
        ? await this.alternativeTitleService.findAllByMovieIds(movieIds)
        : [];

    // Create a map of movie ID to titles for O(1) lookup
    const titlesByMovieId = this.groupByMovieId(allTitles);

    // Map the movies with their titles
    const moviesWithTitles = movies.map((movie) => ({
      ...movie,
      alternative_titles: titlesByMovieId.get(movie.id) || [],
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
   * Get the poster image for a specific movie
   * @param id Movie ID
   * @returns Movie poster URL
   */
  async getMoviePoster(id: string) {
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['poster'],
    });
    return movie?.poster?.url || null;
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

    const movieIds = movies.map((m) => m.id); // Use optimized methods with language filtering if provided
    const [allTitles, allOverviews] = await Promise.all([
      languageCode
        ? this.alternativeTitleService.findAllByMovieIdsWithLanguage(
            movieIds,
            languageCode,
          )
        : this.alternativeTitleService.findAllByMovieIds(movieIds),
      languageCode
        ? this.alternativeOverviewService.findAllByMovieIdsWithLanguage(
            movieIds,
            languageCode,
          )
        : this.alternativeOverviewService.findAllByMovieIds(movieIds),
    ]);

    // Create optimized maps for O(1) lookup
    const titlesByMovieId = this.groupByMovieId(allTitles);
    const overviewsByMovieId = this.groupByMovieId(allOverviews);

    return movies.map((movie) => ({
      ...movie,
      alternative_titles: (titlesByMovieId.get(movie.id) || []).map(
        (title) => ({
          title: title.title,
          iso_639_1: title.iso_639_1,
        }),
      ),
      alternative_overviews: (overviewsByMovieId.get(movie.id) || []).map(
        (overview) => ({
          overview: overview.overview,
          iso_639_1: overview.iso_639_1,
        }),
      ),
    }));
  }

  // =====================================================
  // ADMIN SUPPORT
  // =====================================================
  async getAdminMovies(params: {
    page: number;
    limit: number;
    search?: string;
    status?: 'all' | 'published' | 'draft';
  }) {
    const { page, limit, search, status } = params;
    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.poster', 'poster');

    if (search) {
      qb.andWhere('movie.title ILIKE :search', { search: `%${search}%` });
    }
    if (status && status !== 'all') {
      qb.andWhere('movie.status = :status', { status });
    }

    qb.orderBy('movie.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const movies: AdminMovieItem[] = items.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.overview ?? '',
      release_date: m.release_date ?? null,
      poster_url: m.poster?.url ?? null,
      trailer_url: null,
      status: m.status ?? 'published',
      genres: (m.genres || []).map((g) => {
        const en = (g.names || []).find((n) => n.iso_639_1 === 'en');
        const name = en?.name || g.names?.[0]?.name || 'Unknown';
        return { id: g.id, name };
      }),
      vote_average: m.vote_average,
      popularity: m.popularity,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));

    const pageInfo = {
      movies,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };

    return pageInfo;
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
  async addLanguageToMovie(
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

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Helper method to group items by movie ID
   * @param items Array of items with movie relation
   * @returns Map of movie IDs to items
   */
  private groupByMovieId<T extends { movie: { id: string } }>(
    items: T[],
  ): Map<string, T[]> {
    return items.reduce((acc, item) => {
      const movieId = item.movie.id;
      if (!acc.has(movieId)) {
        acc.set(movieId, []);
      }
      acc.get(movieId)!.push(item);
      return acc;
    }, new Map<string, T[]>());
  }

  /**
   * Apply filters to query builder
   * @param queryBuilder SelectQueryBuilder instance
   * @param filters Filter parameters
   * @param addJoinIfNeeded Function to add joins conditionally
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<Movie>,
    filters: Partial<MovieFilters>,
    addJoinIfNeeded: (
      joinName: string,
      joinPath: string,
      alias: string,
    ) => void,
  ) {
    // Language filters
    if (filters.language) {
      addJoinIfNeeded(
        'spoken_languages',
        'movie.spoken_languages',
        'spoken_language',
      );
      queryBuilder.andWhere('spoken_language.iso_639_1 = :language', {
        language: filters.language,
      });
    }

    // Original language filter
    if (filters.original_language) {
      addJoinIfNeeded(
        'original_language',
        'movie.original_language',
        'original_language',
      );
      queryBuilder.andWhere('original_language.iso_639_1 = :originalLanguage', {
        originalLanguage: filters.original_language,
      });
    }

    // Genre filters
    if (filters.genres) {
      const genres = Array.isArray(filters.genres)
        ? filters.genres
        : [filters.genres];
      if (genres.length > 0) {
        addJoinIfNeeded('genres', 'movie.genres', 'genre');
        queryBuilder.andWhere('genre.id IN (:...genreIds)', {
          genreIds: genres,
        });
      }
    }

    // Production company filter
    if (filters.production_company) {
      addJoinIfNeeded(
        'production_companies',
        'movie.production_companies',
        'production_company',
      );
      queryBuilder.andWhere('production_company.id = :productionCompany', {
        productionCompany: filters.production_company,
      });
    }

    // Text search filters
    if (filters.title) {
      queryBuilder.andWhere('movie.title ILIKE :title', {
        title: `%${filters.title}%`,
      });
    }

    if (filters.overview) {
      queryBuilder.andWhere('movie.overview ILIKE :overview', {
        overview: `%${filters.overview}%`,
      });
    }

    // Release year filter
    if (filters.release_year) {
      const year =
        typeof filters.release_year === 'string'
          ? parseInt(filters.release_year, 10)
          : filters.release_year;
      queryBuilder.andWhere('EXTRACT(YEAR FROM movie.release_date) = :year', {
        year,
      });
    }

    // Vote average filters
    if (filters.min_vote_average !== undefined) {
      const minVoteAvg =
        typeof filters.min_vote_average === 'string'
          ? parseFloat(filters.min_vote_average)
          : filters.min_vote_average;
      queryBuilder.andWhere('movie.vote_average >= :minVoteAverage', {
        minVoteAverage: minVoteAvg,
      });
    }

    if (filters.max_vote_average !== undefined) {
      const maxVoteAvg =
        typeof filters.max_vote_average === 'string'
          ? parseFloat(filters.max_vote_average)
          : filters.max_vote_average;
      queryBuilder.andWhere('movie.vote_average <= :maxVoteAverage', {
        maxVoteAverage: maxVoteAvg,
      });
    }

    // Popularity filters
    if (filters.min_popularity !== undefined) {
      const minPop =
        typeof filters.min_popularity === 'string'
          ? parseFloat(filters.min_popularity)
          : filters.min_popularity;
      queryBuilder.andWhere('movie.popularity >= :minPopularity', {
        minPopularity: minPop,
      });
    }

    if (filters.max_popularity !== undefined) {
      const maxPop =
        typeof filters.max_popularity === 'string'
          ? parseFloat(filters.max_popularity)
          : filters.max_popularity;
      queryBuilder.andWhere('movie.popularity <= :maxPopularity', {
        maxPopularity: maxPop,
      });
    }

    // Adult content filter
    if (filters.adult !== undefined) {
      const isAdult =
        typeof filters.adult === 'string'
          ? filters.adult === 'true'
          : filters.adult;
      queryBuilder.andWhere('movie.adult = :adult', { adult: isAdult });
    }

    // Status filter
    if (filters.status) {
      queryBuilder.andWhere('movie.status = :status', {
        status: filters.status,
      });
    }
  }

  /**
   * Apply ordering to query builder
   * @param queryBuilder QueryBuilder instance
   * @param filters Filter parameters containing sort options
   */
  private applyOrdering(
    queryBuilder: SelectQueryBuilder<Movie>,
    filters: Partial<MovieFilters>,
  ) {
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
}

// Helper types and interfaces
type AdminMovieItem = {
  id: string;
  title: string;
  description: string;
  release_date: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  status: string;
  genres: Array<{ id: string; name: string }>;
  vote_average: number;
  popularity: number;
  created_at: Date;
  updated_at: Date;
};

type MovieFilters = {
  language?: string;
  genres?: string | string[];
  production_company?: string;
  original_language?: string;
  title?: string;
  overview?: string;
  release_year?: number | string;
  min_vote_average?: number | string;
  max_vote_average?: number | string;
  min_popularity?: number | string;
  max_popularity?: number | string;
  adult?: boolean | string;
  status?: string;
  sort_by?:
    | 'release_date'
    | 'vote_average'
    | 'title'
    | 'vote_count'
    | 'popularity';
  sort_order?: 'ASC' | 'DESC';
};
