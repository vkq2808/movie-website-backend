import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovieWatchProvider } from './movie-watch-provider.entity';
import { WatchProvider } from './watch-provider.entity';
import { Movie } from '../movie/movie.entity';
import { AvailabilityType } from '@/common/enums';
import {
  SyncMovieWatchProvidersDto,
  WatchProviderApiResponseDto,
  MovieWatchProviderApiResponseDto
} from './watch-provider.dto';

@Injectable()
export class MovieWatchProviderService {
  constructor(
    @InjectRepository(MovieWatchProvider)
    private readonly movieWatchProviderRepository: Repository<MovieWatchProvider>,
    @InjectRepository(WatchProvider)
    private readonly watchProviderRepository: Repository<WatchProvider>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) { }

  async syncWatchProvidersForMovie(
    syncDto: SyncMovieWatchProvidersDto,
    apiData: MovieWatchProviderApiResponseDto
  ): Promise<MovieWatchProvider[]> {
    const { movieId, region = 'US' } = syncDto;
    const results: MovieWatchProvider[] = [];

    // Remove existing entries for this movie and region
    await this.movieWatchProviderRepository.delete({
      movie: { id: movieId },
      region,
    });

    // Process each availability type
    const availabilityMappings: Array<{
      type: AvailabilityType;
      providers: WatchProviderApiResponseDto[] | undefined;
    }> = [
        { type: AvailabilityType.SUBSCRIPTION, providers: apiData.flatrate },
        { type: AvailabilityType.RENT, providers: apiData.rent },
        { type: AvailabilityType.BUY, providers: apiData.buy },
        { type: AvailabilityType.FREE, providers: apiData.free },
      ];

    for (const mapping of availabilityMappings) {
      if (!mapping.providers) continue;

      for (const providerData of mapping.providers) {
        // Find or create the watch provider
        let watchProvider = await this.watchProviderRepository.findOne({
          where: { original_provider_id: providerData.id },
        });

        if (!watchProvider) {
          const newProvider = this.watchProviderRepository.create({
            provider_name: providerData.provider_name,
            logo_url: providerData.logo_path ? `https://image.tmdb.org/t/p/original${providerData.logo_path}` : undefined,
            original_provider_id: providerData.id,
            display_priority: providerData.display_priority,
            is_active: true,
          });
          watchProvider = await this.watchProviderRepository.save(newProvider);
        }

        // Create movie watch provider entry
        const newMovieWatchProvider = this.movieWatchProviderRepository.create({
          movie: { id: movieId },
          watch_provider: watchProvider,
          availability_type: mapping.type,
          region,
          watch_url: apiData.link,
          is_available: true,
          original_provider_id: providerData.id,
        });

        const movieWatchProvider = await this.movieWatchProviderRepository.save(newMovieWatchProvider);

        results.push(movieWatchProvider);
      }
    }

    return results;
  }

  async getWatchProvidersGroupedByType(
    movieId: string,
    region: string = 'US'
  ): Promise<Record<AvailabilityType, MovieWatchProvider[]>> {
    const watchProviders = await this.movieWatchProviderRepository.find({
      where: {
        movie: { id: movieId },
        region,
        is_available: true,
      },
      relations: ['watch_provider'],
      order: {
        watch_provider: { display_priority: 'DESC' },
        availability_type: 'ASC',
      },
    });

    const grouped: Record<AvailabilityType, MovieWatchProvider[]> = {
      [AvailabilityType.STREAM]: [],
      [AvailabilityType.SUBSCRIPTION]: [],
      [AvailabilityType.RENT]: [],
      [AvailabilityType.BUY]: [],
      [AvailabilityType.FREE]: [],
      [AvailabilityType.PREMIUM]: [],
    };

    watchProviders.forEach(provider => {
      if (grouped[provider.availability_type]) {
        grouped[provider.availability_type].push(provider);
      }
    });

    return grouped;
  }

  async getMovieWatchProviderStats(movieId: string): Promise<{
    totalProviders: number;
    availableRegions: string[];
    availabilityTypes: AvailabilityType[];
  }> {
    const providers = await this.movieWatchProviderRepository.find({
      where: { movie: { id: movieId }, is_available: true },
    });

    const regions = [...new Set(providers.map(p => p.region))];
    const types = [...new Set(providers.map(p => p.availability_type))];

    return {
      totalProviders: providers.length,
      availableRegions: regions,
      availabilityTypes: types,
    };
  }

  async findCheapestOption(
    movieId: string,
    region: string = 'US',
    availabilityType?: AvailabilityType
  ): Promise<MovieWatchProvider | null> {
    const query = this.movieWatchProviderRepository.createQueryBuilder('mwp')
      .leftJoinAndSelect('mwp.watch_provider', 'wp')
      .where('mwp.movie_id = :movieId', { movieId })
      .andWhere('mwp.region = :region', { region })
      .andWhere('mwp.is_available = :isAvailable', { isAvailable: true })
      .andWhere('mwp.price IS NOT NULL');

    if (availabilityType) {
      query.andWhere('mwp.availability_type = :type', { type: availabilityType });
    }

    return query
      .orderBy('mwp.price', 'ASC')
      .getOne();
  }

  async bulkUpdateAvailability(
    movieId: string,
    region: string,
    isAvailable: boolean
  ): Promise<void> {
    await this.movieWatchProviderRepository.update({
      movie: { id: movieId },
      region,
    }, { is_available: isAvailable });
  }
}