import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlternativeOverview } from './alternative-overview.entity';

@Injectable()
export class AlternativeOverviewService {
  constructor(
    @InjectRepository(AlternativeOverview)
    private readonly alternativeOverviewRepository: Repository<AlternativeOverview>,
  ) { }

  async findAllByMovieId(movieId: string): Promise<AlternativeOverview[]> {
    return this.alternativeOverviewRepository.find({
      where: { movie: { id: movieId } }
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
}
