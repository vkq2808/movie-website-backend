import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AlternativeOverview } from './alternative-overview.entity';

@Injectable()
export class AlternativeOverviewService {
  constructor(
    @InjectRepository(AlternativeOverview)
    private readonly alternativeOverviewRepository: Repository<AlternativeOverview>,
  ) {}

  async findAllByMovieId(movieId: string): Promise<AlternativeOverview[]> {
    return this.alternativeOverviewRepository.find({
      where: { movie: { id: movieId } },
    });
  }

  async saveAlternativeOverview(
    movieId: string,
    overview: string,
    languageCode: string,
  ): Promise<AlternativeOverview> {
    const alternativeOverview = this.alternativeOverviewRepository.create({
      overview,
      language_code: languageCode,
      movie: { id: movieId },
    });

    return this.alternativeOverviewRepository.save(alternativeOverview);
  }

  async remove(id: string): Promise<void> {
    await this.alternativeOverviewRepository.delete(id);
  }

  async removeAllByMovieId(movieId: string): Promise<void> {
    await this.alternativeOverviewRepository
      .createQueryBuilder()
      .delete()
      .where('movie_id = :movieId', { movieId })
      .execute();
  }

  async findAllByMovieIds(movieIds: string[]): Promise<AlternativeOverview[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }

    return this.alternativeOverviewRepository
      .createQueryBuilder('overview')
      .leftJoinAndSelect('overview.movie', 'movie')
      .where('movie.id IN (:...movieIds)', { movieIds })
      .orderBy('overview.language_code', 'ASC')
      .getMany();
  }

  /**
   * Find alternative overviews by movie IDs with language filtering
   * @param movieIds Array of movie IDs
   * @param languageCode Optional language code filter
   * @returns Array of alternative overviews
   */
  async findAllByMovieIdsWithLanguage(
    movieIds: string[],
    languageCode?: string,
  ): Promise<AlternativeOverview[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }

    const queryBuilder = this.alternativeOverviewRepository
      .createQueryBuilder('overview')
      .leftJoinAndSelect('overview.movie', 'movie')
      .where('movie.id IN (:...movieIds)', { movieIds });

    if (languageCode) {
      queryBuilder.andWhere('overview.language_code = :languageCode', {
        languageCode,
      });
    }

    return queryBuilder.orderBy('overview.language_code', 'ASC').getMany();
  }

  /**
   * Find alternative overviews with pagination
   * @param movieId Movie ID
   * @param page Page number (starting from 1)
   * @param limit Number of items per page
   * @returns Paginated alternative overviews
   */
  async findByMovieIdPaginated(
    movieId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: AlternativeOverview[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    const [data, total] = await this.alternativeOverviewRepository.findAndCount(
      {
        where: { movie: { id: movieId } },
        skip: offset,
        take: limit,
        order: { language_code: 'ASC' },
      },
    );

    return { data, total, page, limit };
  }

  /**
   * Check if alternative overview exists for movie and language
   * @param movieId Movie ID
   * @param languageCode Language code
   * @returns Boolean indicating existence
   */
  async existsByMovieAndLanguage(
    movieId: string,
    languageCode: string,
  ): Promise<boolean> {
    const count = await this.alternativeOverviewRepository.count({
      where: {
        movie: { id: movieId },
        language_code: languageCode,
      },
    });
    return count > 0;
  }

  /**
   * Bulk save alternative overviews with conflict resolution
   * @param overviews Array of overview data
   * @returns Array of saved alternative overviews
   */
  async bulkSave(
    overviews: Array<{
      movieId: string;
      overview: string;
      languageCode: string;
    }>,
  ): Promise<AlternativeOverview[]> {
    const entities = overviews.map((data) =>
      this.alternativeOverviewRepository.create({
        overview: data.overview,
        language_code: data.languageCode,
        movie: { id: data.movieId },
      }),
    );

    return this.alternativeOverviewRepository.save(entities);
  }
}
