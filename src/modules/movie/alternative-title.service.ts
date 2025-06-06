import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { AlternativeTitle } from './alternative-title.entity';
import { Movie } from './movie.entity';
import { ResourcesNotFoundException } from '@/exceptions/ResoucesNotFoundException';

@Injectable()
export class AlternativeTitleService {
  constructor(
    @InjectRepository(AlternativeTitle)
    private alternativeTitleRepository: Repository<AlternativeTitle>,
    @InjectRepository(Movie)
    private movieRepository: Repository<Movie>,
    private dataSource: DataSource,
  ) {}

  async findAll(): Promise<AlternativeTitle[]> {
    return this.alternativeTitleRepository.find({
      relations: ['movie'],
    });
  }

  async findAllByMovieId(movieId: string): Promise<AlternativeTitle[]> {
    return this.alternativeTitleRepository.find({
      where: { movie: { id: movieId } },
    });
  }

  async findAllByMovieIds(movieIds: string[]): Promise<AlternativeTitle[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }

    return this.alternativeTitleRepository
      .createQueryBuilder('title')
      .leftJoinAndSelect('title.movie', 'movie')
      .where('movie.id IN (:...movieIds)', { movieIds })
      .orderBy('title.country_code', 'ASC')
      .addOrderBy('title.type', 'ASC')
      .getMany();
  }

  async importAlternativeTitles(
    movieId: string,
    alternativeTitles: { title: string; country_code: string; type?: string }[],
  ): Promise<AlternativeTitle[]> {
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
    });
    if (!movie) {
      throw new ResourcesNotFoundException('Movie not found');
    }

    const titles = alternativeTitles.map((titleData) =>
      this.alternativeTitleRepository.create({
        ...titleData,
        movie,
      }),
    );

    return this.alternativeTitleRepository.save(titles);
  }

  async remove(id: string): Promise<void> {
    await this.alternativeTitleRepository.delete(id);
  }

  async removeAllByMovieId(movieId: string): Promise<void> {
    await this.alternativeTitleRepository
      .createQueryBuilder()
      .delete()
      .where('movie_id = :movieId', { movieId })
      .execute();
  }

  /**
   * Find alternative titles by movie IDs with country filtering
   * @param movieIds Array of movie IDs
   * @param countryCode Optional country code filter
   * @returns Array of alternative titles
   */
  async findAllByMovieIdsWithCountry(
    movieIds: string[],
    countryCode?: string,
  ): Promise<AlternativeTitle[]> {
    if (!movieIds || movieIds.length === 0) {
      return [];
    }

    const queryBuilder = this.alternativeTitleRepository
      .createQueryBuilder('title')
      .leftJoinAndSelect('title.movie', 'movie')
      .where('movie.id IN (:...movieIds)', { movieIds });

    if (countryCode) {
      queryBuilder.andWhere('title.country_code = :countryCode', {
        countryCode,
      });
    }

    return queryBuilder
      .orderBy('title.country_code', 'ASC')
      .addOrderBy('title.type', 'ASC')
      .getMany();
  }

  /**
   * Find alternative titles with pagination
   * @param movieId Movie ID
   * @param page Page number (starting from 1)
   * @param limit Number of items per page
   * @returns Paginated alternative titles
   */
  async findByMovieIdPaginated(
    movieId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: AlternativeTitle[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    const [data, total] = await this.alternativeTitleRepository.findAndCount({
      where: { movie: { id: movieId } },
      skip: offset,
      take: limit,
      order: { country_code: 'ASC', type: 'ASC' },
    });

    return { data, total, page, limit };
  }

  /**
   * Check if alternative title exists for movie and country
   * @param movieId Movie ID
   * @param countryCode Country code
   * @param title Title text
   * @returns Boolean indicating existence
   */
  async existsByMovieCountryAndTitle(
    movieId: string,
    countryCode: string,
    title: string,
  ): Promise<boolean> {
    const count = await this.alternativeTitleRepository.count({
      where: {
        movie: { id: movieId },
        country_code: countryCode,
        title: title,
      },
    });
    return count > 0;
  }

  /**
   * Bulk import alternative titles with conflict resolution
   * @param movieId Movie ID
   * @param alternativeTitles Array of title data
   * @param skipDuplicates Whether to skip duplicate titles
   * @returns Array of imported alternative titles
   */
  async bulkImportAlternativeTitles(
    movieId: string,
    alternativeTitles: { title: string; country_code: string; type?: string }[],
    skipDuplicates: boolean = true,
  ): Promise<AlternativeTitle[]> {
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
    });
    if (!movie) {
      throw new ResourcesNotFoundException('Movie not found');
    }

    const validTitles: AlternativeTitle[] = [];

    for (const titleData of alternativeTitles) {
      if (skipDuplicates) {
        const exists = await this.existsByMovieCountryAndTitle(
          movieId,
          titleData.country_code,
          titleData.title,
        );
        if (exists) continue;
      }

      validTitles.push(
        this.alternativeTitleRepository.create({
          ...titleData,
          movie,
        }),
      );
    }

    if (validTitles.length === 0) {
      return [];
    }

    return this.alternativeTitleRepository.save(validTitles);
  }

  /**
   * Get alternative titles grouped by country
   * @param movieId Movie ID
   * @returns Map of country codes to alternative titles
   */
  async getAlternativeTitlesGroupedByCountry(
    movieId: string,
  ): Promise<Map<string, AlternativeTitle[]>> {
    const titles = await this.findAllByMovieId(movieId);
    const groupedTitles = new Map<string, AlternativeTitle[]>();

    for (const title of titles) {
      const countryCode = title.country_code;
      if (!groupedTitles.has(countryCode)) {
        groupedTitles.set(countryCode, []);
      }
      groupedTitles.get(countryCode)!.push(title);
    }

    return groupedTitles;
  }
}
