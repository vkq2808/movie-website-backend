import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindManyOptions } from 'typeorm';
import { WatchProvider } from './watch-provider.entity';
import { MovieWatchProvider } from './movie-watch-provider.entity';
import { AvailabilityType } from '@/common/enums';
import { INITIAL_WATCH_PROVIDERS } from '@/common/constants/watch-providers.constant';
import {
  CreateWatchProviderDto,
  UpdateWatchProviderDto,
  CreateMovieWatchProviderDto,
  FindMovieWatchProvidersDto,
} from './watch-provider.dto';

@Injectable()
export class WatchProviderService {
  constructor(
    @InjectRepository(WatchProvider)
    private readonly watchProviderRepository: Repository<WatchProvider>,
    @InjectRepository(MovieWatchProvider)
    private readonly movieWatchProviderRepository: Repository<MovieWatchProvider>,
  ) {}

  // WatchProvider CRUD operations
  async findAllProviders(
    options?: FindManyOptions<WatchProvider>,
  ): Promise<WatchProvider[]> {
    return this.watchProviderRepository.find({
      order: { display_priority: 'DESC', provider_name: 'ASC' },
      ...options,
    });
  }

  async findProviderById(id: string): Promise<WatchProvider | null> {
    return this.watchProviderRepository.findOne({
      where: { id },
      relations: ['movie_watch_providers'],
    });
  }

  async findProviderByOriginalId(
    original_provider_id: number,
  ): Promise<WatchProvider | null> {
    return this.watchProviderRepository.findOne({
      where: { original_provider_id },
    });
  }

  async findBySlug(slug: string): Promise<WatchProvider | null> {
    return this.watchProviderRepository.findOne({
      where: { slug },
    });
  }

  async create(providerData: any): Promise<WatchProvider> {
    const provider = this.watchProviderRepository.create({
      provider_name: providerData.name,
      slug: providerData.slug,
      description: providerData.description,
      logo_url: providerData.logo_url,
      website_url: providerData.website_url,
      original_provider_id: providerData.tmdb_provider_id,
      display_priority: providerData.priority,
      is_active: true,
    });
    return this.watchProviderRepository.save(provider);
  }

  async createProvider(
    createDto: CreateWatchProviderDto,
  ): Promise<WatchProvider> {
    const provider = this.watchProviderRepository.create(createDto);
    return this.watchProviderRepository.save(provider);
  }

  async updateProvider(
    id: string,
    updateDto: UpdateWatchProviderDto,
  ): Promise<WatchProvider | null> {
    const result = await this.watchProviderRepository.update(id, updateDto);
    if (result.affected === 0) {
      return null;
    }
    return this.findProviderById(id);
  }

  async deleteProvider(id: string): Promise<boolean> {
    const result = await this.watchProviderRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findOrCreateProvider(
    providerData: CreateWatchProviderDto,
  ): Promise<WatchProvider> {
    let provider = await this.findProviderByOriginalId(
      providerData.original_provider_id,
    );

    if (!provider) {
      provider = await this.createProvider(providerData);
    }

    return provider;
  }

  // MovieWatchProvider operations
  async findMovieWatchProviders(
    criteria: FindMovieWatchProvidersDto,
  ): Promise<MovieWatchProvider[]> {
    const where: FindOptionsWhere<MovieWatchProvider> = {};

    if (criteria.movie_id) {
      where.movie = { id: criteria.movie_id };
    }
    if (criteria.region) {
      where.region = criteria.region;
    }
    if (criteria.availability_type) {
      where.availability_type = criteria.availability_type;
    }
    if (criteria.is_available !== undefined) {
      where.is_available = criteria.is_available;
    }

    return this.movieWatchProviderRepository.find({
      where,
      relations: ['movie', 'watch_provider'],
      order: {
        watch_provider: { display_priority: 'DESC' },
        availability_type: 'ASC',
        price: 'ASC',
      },
    });
  }

  async findWatchProvidersForMovie(
    movieId: string,
    region: string = 'US',
    availabilityTypes?: AvailabilityType[],
  ): Promise<MovieWatchProvider[]> {
    const query = this.movieWatchProviderRepository
      .createQueryBuilder('mwp')
      .leftJoinAndSelect('mwp.watch_provider', 'wp')
      .leftJoinAndSelect('mwp.movie', 'm')
      .where('m.id = :movieId', { movieId })
      .andWhere('mwp.region = :region', { region })
      .andWhere('mwp.is_available = :isAvailable', { isAvailable: true })
      .andWhere('wp.is_active = :isActive', { isActive: true });

    if (availabilityTypes && availabilityTypes.length > 0) {
      query.andWhere('mwp.availability_type IN (:...types)', {
        types: availabilityTypes,
      });
    }

    // Check if still within availability window
    const now = new Date();
    query.andWhere(
      '(mwp.available_from IS NULL OR mwp.available_from <= :now)',
      { now },
    );
    query.andWhere(
      '(mwp.available_until IS NULL OR mwp.available_until >= :now)',
      { now },
    );

    return query
      .orderBy('wp.display_priority', 'DESC')
      .addOrderBy('mwp.availability_type', 'ASC')
      .addOrderBy('mwp.price', 'ASC')
      .getMany();
  }

  async createMovieWatchProvider(
    createDto: CreateMovieWatchProviderDto,
  ): Promise<MovieWatchProvider> {
    const movieWatchProvider = this.movieWatchProviderRepository.create({
      movie: { id: createDto.movie_id },
      watch_provider: { id: createDto.watch_provider_id },
      availability_type: createDto.availability_type,
      region: createDto.region || 'US',
      price: createDto.price,
      currency: createDto.currency,
      watch_url: createDto.watch_url,
      quality: createDto.quality,
      audio_language: createDto.audio_language,
      subtitle_languages: createDto.subtitle_languages,
      is_available: createDto.is_available !== false,
      available_from: createDto.available_from,
      available_until: createDto.available_until,
      original_provider_id: createDto.original_provider_id,
    });

    return this.movieWatchProviderRepository.save(movieWatchProvider);
  }

  async updateMovieWatchProvider(
    id: string,
    updateDto: Partial<CreateMovieWatchProviderDto>,
  ): Promise<MovieWatchProvider | null> {
    const result = await this.movieWatchProviderRepository.update(
      id,
      updateDto,
    );
    if (result.affected === 0) {
      return null;
    }
    return this.movieWatchProviderRepository.findOne({
      where: { id },
      relations: ['movie', 'watch_provider'],
    });
  }

  async deleteMovieWatchProvider(id: string): Promise<boolean> {
    const result = await this.movieWatchProviderRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getAvailableRegions(): Promise<string[]> {
    const result = await this.movieWatchProviderRepository
      .createQueryBuilder('mwp')
      .select('DISTINCT mwp.region', 'region')
      .where('mwp.is_available = :isAvailable', { isAvailable: true })
      .getRawMany();

    return result.map((row) => row.region).filter(Boolean);
  }

  async getPopularProviders(
    region: string = 'US',
    limit: number = 10,
  ): Promise<WatchProvider[]> {
    const result = await this.watchProviderRepository
      .createQueryBuilder('wp')
      .leftJoin('wp.movie_watch_providers', 'mwp')
      .where('wp.is_active = :isActive', { isActive: true })
      .andWhere('mwp.region = :region', { region })
      .andWhere('mwp.is_available = :isAvailable', { isAvailable: true })
      .groupBy('wp.id')
      .orderBy('COUNT(mwp.id)', 'DESC')
      .addOrderBy('wp.display_priority', 'DESC')
      .limit(limit)
      .getMany();

    return result;
  }

  /**
   * Initialize default watch providers from INITIAL_WATCH_PROVIDERS constant
   * This can be called on application startup to ensure popular providers are available
   * @returns Array of created/found watch provider entities
   */
  async initializeDefaultProviders(): Promise<WatchProvider[]> {
    const providers: WatchProvider[] = [];

    for (let i = 0; i < INITIAL_WATCH_PROVIDERS.length; i++) {
      const providerData = INITIAL_WATCH_PROVIDERS[i];

      try {
        // Check if provider already exists by slug
        let provider = await this.findBySlug(providerData.slug);

        if (!provider) {
          // Create new provider if it doesn't exist
          provider = await this.create(providerData);
          console.log(`Created watch provider: ${provider.provider_name}`);
        } else {
          console.log(
            `Watch provider already exists: ${provider.provider_name}`,
          );
        }

        providers.push(provider);
      } catch (error) {
        console.error(
          `Error initializing watch provider ${providerData.name}:`,
          error,
        );
        // Continue with other providers even if one fails
      }
    }

    console.log(`Initialized ${providers.length} watch providers`);
    return providers;
  }

  /**
   * Get all initial watch providers from the INITIAL_WATCH_PROVIDERS constant
   * @returns Array of initial provider data
   */
  getInitialProviders() {
    return INITIAL_WATCH_PROVIDERS;
  }

  /**
   * Find initial provider information by slug from INITIAL_WATCH_PROVIDERS constant
   * This does not query the database, just provides info from the constant
   * @param slug Provider slug
   * @returns Provider info object or null if not in initial providers
   */
  findInitialProviderBySlug(slug: string) {
    const provider = INITIAL_WATCH_PROVIDERS.find((p) => p.slug === slug);
    return provider || null;
  }
}
