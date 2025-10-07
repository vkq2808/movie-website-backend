// filepath: c:\Users\Administrator\Desktop\code\be\src\modules\movie\movie.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder, In } from 'typeorm';
import { Movie } from '../entities/movie.entity';
import { Genre } from '../../genre/genre.entity';
import { Video } from '../../video/video.entity';
import { Language } from '../../language/language.entity';
import { LanguageService } from '../../language/language.service';
import { Keyword } from '../../keyword/keyword.entity';
import { ProductionCompany } from '../../production-company/production-company.entity';
import { MovieCast } from '../entities/movie-cast.entity';
import { MovieCrew } from '../entities/movie-crew.entity';
import { MovieWatchProviderService } from '../../watch-provider/movie-watch-provider.service';
import { AvailabilityType } from '@/common/enums';
import { MovieWatchProvider } from '../../watch-provider/movie-watch-provider.entity';
import { modelNames } from '@/common/constants/model-name.constant';
type ProviderItem = {
  availability_type: AvailabilityType;
  region: string;
  price: number | null;
  currency: string | null;
  watch_url: string | null;
  provider: {
    id: string;
    original_provider_id: number;
    name: string;
    slug: string;
    logo_url: string | null;
    display_priority: number;
  };
};

type ProvidersByType = Record<AvailabilityType, ProviderItem[]>;

type CastAndCrewResult = Awaited<ReturnType<MovieService['getCastAndCrew']>>;

type VideosResult = Awaited<ReturnType<MovieService['getVideos']>>;

type MovieDetailsResult = {
  movie?: Movie;
  cast_and_crew?: CastAndCrewResult;
  videos?: VideosResult;
  watch_providers?: ProvidersByType;
};

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(ProductionCompany)
    private readonly productionCompanyRepository: Repository<ProductionCompany>,
    @InjectRepository(MovieCast)
    private readonly movieCastRepository: Repository<MovieCast>,
    @InjectRepository(MovieCrew)
    private readonly movieCrewRepository: Repository<MovieCrew>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly languageService: LanguageService,
    private readonly movieWatchProviderService: MovieWatchProviderService,
    private dataSource: DataSource,
  ) { }

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
      relations: [modelNames.MOVIE_SPOKEN_LANGUAGE, 'genres',],
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
  async getMovieById(id: string): Promise<Movie | null> {
    // Step 1: Get basic movie data with essential relations
    const movie = await this.movieRepository
      .createQueryBuilder('movie')
      // 1️⃣ Movie fields
      .leftJoinAndSelect('movie.original_language', 'original_language')

      // 2️⃣ Genres
      .leftJoinAndSelect('movie.genres', 'genres')

      // 3️⃣ Spoken languages
      .leftJoinAndSelect('movie.spoken_languages', 'spoken_languages')

      // 4️⃣ Cast + Person (vì bạn muốn lấy cả person của cast)
      .leftJoinAndSelect('movie.cast', 'cast')
      .leftJoinAndSelect('cast.person', 'cast_person') // nếu entity cast có quan hệ person

      // 5️⃣ Production companies
      .leftJoinAndSelect('movie.production_companies', 'production_companies')
      // 6️⃣ Filter conditions
      .where('movie.id = :id', { id })
      .andWhere('movie.deleted_at IS NULL')

      // 7️⃣ Thực thi
      .getOne();

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
    const addJoinIfNeeded = (joinName: string, joinPath: string, alias: string) => {
      if (!addedJoins.has(joinName)) {
        queryBuilder.leftJoinAndSelect(joinPath, alias);
        addedJoins.add(joinName);
      }
    };

    // Always load essential relations for better UX
    const alwaysLoadRelations = ['genres'];
    alwaysLoadRelations.forEach((relation) => {
      addJoinIfNeeded(relation, `movie.${relation}`, relation);
    });

    // Apply dynamic filters and add joins as needed
    this.applyFilters(queryBuilder, filters, addJoinIfNeeded);

    // Apply ordering
    this.applyOrdering(queryBuilder, filters);

    // Apply pagination
    queryBuilder.skip(offset).take(limit);

    // Ensure soft-deleted records are excluded
    queryBuilder.andWhere('movie.deleted_at IS NULL');

    // Execute query
    const [movies, totalCount] = await queryBuilder.getManyAndCount();

    return {
      data: movies,
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
    });
    return movie?.posters?.[0]?.url || null;
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
      .where('movie.deleted_at IS NULL')
      .orderBy('movie.popularity', 'DESC')
      .take(limit)
      .getMany();

    if (!movies.length) {
      console.log("No movies")
      return [];
    }
    console.log("Returned movies:", movies.map(m => m.title).join(", "))

    return movies;
  }

  // =====================================================
  // ADMIN SUPPORT
  // =====================================================
  async getAdminMovies(params: {
    page: number;
    limit: number;
    search?: string;
    status?: 'all' | 'published' | 'draft' | 'archived';
  }) {
    const { page, limit, search, status } = params;
    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres');

    // Exclude soft-deleted by default in admin list
    qb.andWhere('movie.deleted_at IS NULL');

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
      poster_url: m.posters?.[0]?.url ?? null,
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
  // SOFT DELETE / RESTORE
  // =====================================================
  async softDeleteMovie(id: string): Promise<void> {
    // Using soft delete marks the deleted_at automatically because we added DeleteDateColumn
    await this.movieRepository.softDelete({ id });
  }

  async restoreMovie(id: string): Promise<void> {
    await this.movieRepository.restore({ id });
  }

  // =====================================================
  // LANGUAGE MANAGEMENT
  // =====================================================

  // =====================================================
  // DISCOVERY FUNCTIONS
  // =====================================================
  async getTrendingMovies(
    timeWindow: 'day' | 'week' = 'day',
    page = 1,
    limit = 10,
  ) {
    const offset = (page - 1) * limit;
    const now = new Date();
    const windowDays = timeWindow === 'day' ? 1 : 7;
    const startDate = new Date(
      now.getTime() - windowDays * 24 * 60 * 60 * 1000,
    );

    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .where('movie.deleted_at IS NULL')
      .andWhere('movie.updated_at >= :startDate', { startDate })
      .orderBy('movie.popularity', 'DESC')
      .addOrderBy('movie.vote_count', 'DESC')
      .skip(offset)
      .take(limit);

    const [items, totalCount] = await qb.getManyAndCount();
    return {
      data: items,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        timeWindow,
      },
    };
  }

  async getTopRatedMovies(minVoteCount = 100, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .where('movie.deleted_at IS NULL')
      .andWhere('movie.vote_count >= :minVoteCount', { minVoteCount })
      .orderBy('movie.vote_average', 'DESC')
      .addOrderBy('movie.vote_count', 'DESC')
      .addOrderBy('movie.popularity', 'DESC')
      .skip(offset)
      .take(limit);

    const [items, totalCount] = await qb.getManyAndCount();
    return {
      data: items,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        minVoteCount,
      },
    };
  }

  async getNowPlayingMovies(days: number = 30, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .where('movie.deleted_at IS NULL')
      .andWhere('movie.release_date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('movie.release_date', 'DESC')
      .addOrderBy('movie.popularity', 'DESC')
      .skip(offset)
      .take(limit);

    const [items, totalCount] = await qb.getManyAndCount();
    return {
      data: items,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        windowDays: days,
      },
    };
  }

  async getSimilarMovies(movieId: string, page = 1, limit = 10) {
    // Load target movie's genres and keywords
    const [genres, keywords] = await Promise.all([
      this.movieRepository
        .createQueryBuilder('movie')
        .relation('genres')
        .of(movieId)
        .loadMany(),
      this.movieRepository
        .createQueryBuilder('movie')
        .relation('keywords')
        .of(movieId)
        .loadMany(),
    ]);

    const genreIds = (genres || []).map((g: Genre) => g.id);
    const keywordIds = (keywords || []).map((k: Keyword) => k.id);

    if (genreIds.length === 0 && keywordIds.length === 0) {
      return {
        data: [],
        meta: { page, limit, totalCount: 0, totalPages: 0 },
      };
    }

    const offset = (page - 1) * limit;

    // Base query to compute similarity scores and collect candidate IDs
    const base = this.movieRepository
      .createQueryBuilder('m')
      .leftJoin(
        'm.genres',
        'g',
        genreIds.length ? 'g.id IN (:...genreIds)' : '1=0',
        { genreIds },
      )
      .leftJoin(
        'm.keywords',
        'k',
        keywordIds.length ? 'k.id IN (:...keywordIds)' : '1=0',
        { keywordIds },
      )
      .where('m.deleted_at IS NULL')
      .andWhere('m.id != :movieId', { movieId })
      .andWhere('(g.id IS NOT NULL OR k.id IS NOT NULL)');

    const countQb = base.clone().select('COUNT(DISTINCT m.id)', 'total');
    const totalRaw = await countQb.getRawOne<{ total: string }>();
    const totalCount = totalRaw ? parseInt(totalRaw.total, 10) : 0;

    const scoreQb = base
      .clone()
      .select('m.id', 'id')
      .addSelect('COUNT(DISTINCT g.id) + COUNT(DISTINCT k.id)', 'score')
      .groupBy('m.id')
      .orderBy('score', 'DESC')
      .addOrderBy('m.popularity', 'DESC')
      .addOrderBy('m.vote_count', 'DESC')
      .offset(offset)
      .limit(limit);

    const scored = await scoreQb.getRawMany<{ id: string; score: string }>();
    const ids = scored.map((r) => r.id);

    if (ids.length === 0) {
      return {
        data: [],
        meta: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }

    // Load full entities for selected IDs
    const movies = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres')
      .where('movie.id IN (:...ids)', { ids })
      .andWhere('movie.deleted_at IS NULL')
      .getMany();

    // Sort according to score order
    const orderMap = new Map(ids.map((id, idx) => [id, idx] as const));
    movies.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    return {
      data: movies,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

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
      relations: [modelNames.MOVIE_SPOKEN_LANGUAGE],
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
      relations: [modelNames.MOVIE_SPOKEN_LANGUAGE],
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

  /** Alias to addLanguageToMovie for clarity */
  async addSpokenLanguage(
    movieId: string,
    languageCode: string,
  ): Promise<Movie> {
    return this.addLanguageToMovie(movieId, languageCode);
  }

  /** Alias to removeLanguageFromMovie for clarity */
  async removeSpokenLanguage(
    movieId: string,
    languageCode: string,
  ): Promise<Movie> {
    return this.removeLanguageFromMovie(movieId, languageCode);
  }

  /**
   * Return structured cast and notable crew for a movie
   */
  async getCastAndCrew(movieId: string): Promise<{
    top_cast: Array<{
      id: string;
      character?: string | null;
      order?: number | null;
      person: {
        id: string;
        original_id: number;
        name: string;
        profile_image?: {
          url: string
          alt: string
        }
      };
    }>;
    crew: {
      directors: MovieCrew[];
      writers: MovieCrew[];
      producers: MovieCrew[];
      editors: MovieCrew[];
      cinematography: MovieCrew[];
      music: MovieCrew[];
      others: MovieCrew[];
    };
  }> {
    // Top cast by credited order
    const cast = await this.movieCastRepository.find({
      where: { movie: { id: movieId } },
      order: { order: 'ASC' },
      take: 10,
      relations: [modelNames.PERSON],
    });

    // Notable crew grouped by job/department
    const crew = await this.movieCrewRepository.find({
      where: { movie: { id: movieId } },
      order: { department: 'ASC' },
      relations: [modelNames.PERSON],
    });

    const directors = crew.filter(
      (c) =>
        (c.job || '').toLowerCase() === 'director' ||
        (c.department || '').toLowerCase() === 'directing',
    );
    const writers = crew.filter(
      (c) =>
        ['writer', 'screenplay', 'story'].includes(
          (c.job || '').toLowerCase(),
        ) || (c.department || '').toLowerCase() === 'writing',
    );
    const producers = crew.filter(
      (c) =>
        (c.job || '').toLowerCase().includes('producer') ||
        (c.department || '').toLowerCase() === 'production',
    );
    const editors = crew.filter(
      (c) =>
        (c.job || '').toLowerCase().includes('editor') ||
        (c.department || '').toLowerCase() === 'editing',
    );
    const cinematography = crew.filter(
      (c) =>
        (c.job || '').toLowerCase().includes('cinematograph') ||
        (c.department || '').toLowerCase() === 'camera',
    );
    const music = crew.filter(
      (c) =>
        (c.job || '').toLowerCase().includes('music') ||
        (c.department || '').toLowerCase() === 'sound',
    );

    // Group the rest as others to keep response normalized
    const groupedIds = new Set(
      [
        ...directors,
        ...writers,
        ...producers,
        ...editors,
        ...cinematography,
        ...music,
      ].map((c) => c.id),
    );
    const others = crew.filter((c) => !groupedIds.has(c.id));

    return {
      top_cast: cast.map((c) => ({
        id: c.id,
        character: c.character ?? null,
        order: c.order ?? null,
        person: {
          id: c.person.id,
          original_id: c.person.original_id,
          name: c.person.name,
          profile_image: c.person.profile_image ?? undefined,
        },
      })),
      crew: {
        directors,
        writers,
        producers,
        editors,
        cinematography,
        music,
        others,
      },
    };
  }

  /**
   * Return trailers and clips for a movie (normalized)
   */
  async getVideos(movieId: string): Promise<{
    trailers: Video[];
    clips: Video[];
    teasers: Video[];
    others: Video[];
  }> {
    const videos = await this.videoRepository.find({
      where: { movie: { id: movieId } },
      order: { published_at: 'DESC' },
    });

    const normType = (t: string) => (t || '').toLowerCase();
    const trailers = videos.filter((v) => normType(v.type) === 'trailer');
    const clips = videos.filter((v) => normType(v.type) === 'clip');
    const teasers = videos.filter((v) => normType(v.type) === 'teaser');
    const others = videos.filter(
      (v) => !['trailer', 'clip', 'teaser'].includes(normType(v.type)),
    );

    return { trailers, clips, teasers, others };
  }

  /**
   * Wrapper around MovieWatchProviderService to expose grouped providers
   */
  async getWatchProviders(
    movieId: string,
    region: string = 'US',
  ): Promise<ProvidersByType> {
    const grouped =
      await this.movieWatchProviderService.getWatchProvidersGroupedByType(
        movieId,
        region,
      );

    const mapOne = (item: MovieWatchProvider): ProviderItem => ({
      availability_type: item.availability_type,
      region: item.region,
      price: item.price ?? null,
      currency: item.currency ?? null,
      watch_url: item.watch_url ?? null,
      provider: {
        id: item.watch_provider.id,
        original_provider_id: item.watch_provider.original_provider_id,
        name: item.watch_provider.provider_name,
        slug: item.watch_provider.slug,
        logo_url: item.watch_provider.logo_url ?? null,
        display_priority: item.watch_provider.display_priority ?? 0,
      },
    });

    const result: ProvidersByType = {
      [AvailabilityType.STREAM]: [],
      [AvailabilityType.SUBSCRIPTION]: [],
      [AvailabilityType.RENT]: [],
      [AvailabilityType.BUY]: [],
      [AvailabilityType.FREE]: [],
      [AvailabilityType.PREMIUM]: [],
    };
    (Object.keys(grouped) as Array<keyof typeof grouped>).forEach((k) => {
      result[k] = (grouped[k] || []).map(mapOne);
    });

    return result;
  }

  /**
   * Compose a full movie detail payload with optional controls
   */
  async getMovieDetails(
    movieId: string,
    options?: {
      includeCast?: boolean;
      includeCrew?: boolean; // kept for symmetry (crew comes with cast method)
      includeVideos?: boolean;
      includeWatchProviders?: boolean;
      includeAlternatives?: boolean;
      region?: string;
    },
  ): Promise<MovieDetailsResult> {
    const {
      includeCast = true,
      includeVideos = true,
      includeWatchProviders = true,
      region = 'US',
    } = options || {};

    // Base movie (with alternatives)
    const movie = await this.getMovieById(movieId);

    const tasks: Promise<void>[] = [];
    const payload: MovieDetailsResult = {
      movie: movie ?? undefined,
    };

    if (includeCast) {
      tasks.push(
        this.getCastAndCrew(movieId).then((v) => {
          payload.cast_and_crew = v;
        }),
      );
    }
    if (includeVideos) {
      tasks.push(
        this.getVideos(movieId).then((v) => {
          payload.videos = v;
        }),
      );
    }
    if (includeWatchProviders) {
      tasks.push(
        this.getWatchProviders(movieId, region).then((v) => {
          payload.watch_providers = v;
        }),
      );
    }

    if (tasks.length) await Promise.all(tasks);
    return payload;
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
    addJoinIfNeeded: (joinName: string, joinPath: string, alias: string) => void,
  ) {
    // Language filters
    if (filters.spoken_language) {
      addJoinIfNeeded(modelNames.MOVIE_SPOKEN_LANGUAGE, 'movie.spoken_languages', 'spoken_language',);
      queryBuilder.andWhere('spoken_language.iso_639_1 = :spoken_language', {
        spoken_language: filters.spoken_language,
      });
    }

    // Original language filter
    if (filters.original_language) {
      addJoinIfNeeded('original_language', 'movie.original_language', 'original_language',);
      queryBuilder.andWhere('original_language.iso_639_1 = :originalLanguage', {
        originalLanguage: filters.original_language,
      });
    }

    // Genre filters
    if (filters.genres) {
      // Normalize into array, support comma-separated values from UI (e.g., "id1,id2"), trim, and drop special 'all'
      const rawList = Array.isArray(filters.genres)
        ? filters.genres
        : [filters.genres];
      const genres = rawList
        .flatMap((g) => String(g).split(','))
        .map((g) => g.trim())
        .filter((g) => g.length > 0)
        .filter((g) => g.toLowerCase() !== 'all');

      if (genres.length > 0) {
        addJoinIfNeeded('genres', 'movie.genres', 'genres');
        queryBuilder.andWhere('genres.id IN (:...genreIds)', {
          genreIds: genres,
        });
      }
    }

    // Keyword filters (accepts UUIDs or numeric original_ids)
    if (filters.keywords) {
      const ks = Array.isArray(filters.keywords)
        ? filters.keywords
        : [filters.keywords];
      const keywordValues = ks
        .flatMap((v) => (typeof v === 'string' ? v.split(',') : [v]))
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);

      if (keywordValues.length > 0) {
        addJoinIfNeeded('keywords', 'movie.keywords', 'keyword');
        // Split into numeric original_ids and non-numeric UUIDs
        const keywordOriginalIds = keywordValues
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n));
        const keywordUUIDs = keywordValues.filter(
          (v) => !Number.isFinite(Number(v)),
        );

        if (keywordOriginalIds.length && keywordUUIDs.length) {
          queryBuilder.andWhere(
            '(keyword.original_id IN (:...keywordOriginalIds) OR keyword.id IN (:...keywordUUIDs))',
            { keywordOriginalIds, keywordUUIDs },
          );
        } else if (keywordOriginalIds.length) {
          queryBuilder.andWhere(
            'keyword.original_id IN (:...keywordOriginalIds)',
            {
              keywordOriginalIds,
            },
          );
        } else if (keywordUUIDs.length) {
          queryBuilder.andWhere('keyword.id IN (:...keywordUUIDs)', {
            keywordUUIDs,
          });
        }

        // Ensure unique movies when joining M:N relations with filters
        queryBuilder.distinct(true);
      }
    }

    // Production company filter
    if (filters.production_company) {
      addJoinIfNeeded('production_companies', 'movie.production_companies', 'production_company',);
      queryBuilder.andWhere('production_company.origin_country = :productionCompany', {
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

    // Runtime filters
    if (filters.min_runtime !== undefined) {
      const minRuntime =
        typeof filters.min_runtime === 'string'
          ? parseInt(filters.min_runtime, 10)
          : filters.min_runtime;
      if (Number.isFinite(minRuntime)) {
        queryBuilder.andWhere('movie.runtime >= :minRuntime', { minRuntime });
      }
    }
    if (filters.max_runtime !== undefined) {
      const maxRuntime =
        typeof filters.max_runtime === 'string'
          ? parseInt(filters.max_runtime, 10)
          : filters.max_runtime;
      if (Number.isFinite(maxRuntime)) {
        queryBuilder.andWhere('movie.runtime <= :maxRuntime', { maxRuntime });
      }
    }

    // Price filters
    if (filters.min_price !== undefined) {
      const minPrice =
        typeof filters.min_price === 'string'
          ? parseFloat(filters.min_price)
          : filters.min_price;
      if (Number.isFinite(minPrice)) {
        queryBuilder.andWhere('movie.price >= :minPrice', { minPrice });
      }
    }
    if (filters.max_price !== undefined) {
      const maxPrice =
        typeof filters.max_price === 'string'
          ? parseFloat(filters.max_price)
          : filters.max_price;
      if (Number.isFinite(maxPrice)) {
        queryBuilder.andWhere('movie.price <= :maxPrice', { maxPrice });
      }
    }

    // Presence filters
    if (filters.has_video !== undefined) {
      const hasVideo =
        typeof filters.has_video === 'string'
          ? filters.has_video === 'true'
          : !!filters.has_video;
      // Use videos relation presence
      addJoinIfNeeded('videos', 'movie.videos', 'videos');
      queryBuilder.andWhere(
        hasVideo ? 'videos.id IS NOT NULL' : 'videos.id IS NULL',
      );
      queryBuilder.distinct(true);
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
        queryBuilder.orderBy('movie.release_date', sortOrder, 'NULLS LAST');
        break;
      case 'vote_average':
        queryBuilder.orderBy('movie.vote_average', sortOrder, 'NULLS LAST');
        break;
      case 'title':
        queryBuilder.orderBy('movie.title', sortOrder);
        break;
      case 'vote_count':
        queryBuilder.orderBy('movie.vote_count', sortOrder);
        break;
      case 'runtime':
        queryBuilder.orderBy('movie.runtime', sortOrder, 'NULLS LAST');
        break;
      case 'price':
        queryBuilder.orderBy('movie.price', sortOrder, 'NULLS LAST');
        break;
      default:
        queryBuilder.orderBy('movie.popularity', sortOrder);
    }

    // Stable tie-breaker to ensure deterministic results
    queryBuilder.addOrderBy('movie.id', 'ASC');
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
  spoken_language?: string;
  genres?: string | string[];
  keywords?: string | string[];
  production_company?: string;
  original_language?: string;
  title?: string;
  overview?: string;
  release_year?: number | string;
  min_vote_average?: number | string;
  max_vote_average?: number | string;
  min_popularity?: number | string;
  max_popularity?: number | string;
  min_runtime?: number | string;
  max_runtime?: number | string;
  min_price?: number | string;
  max_price?: number | string;
  has_video?: boolean | string;
  has_backdrop?: boolean | string;
  has_poster?: boolean | string;
  adult?: boolean | string;
  status?: string;
  sort_by?:
  | 'release_date'
  | 'vote_average'
  | 'title'
  | 'vote_count'
  | 'popularity'
  | 'runtime'
  | 'price';
  sort_order?: 'ASC' | 'DESC';
};
