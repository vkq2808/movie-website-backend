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
  ) { }

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
    return this.alternativeTitleRepository.find({
      where: { movie: { id: In(movieIds) } },
      relations: ['movie'], // Explicitly include the movie relation
    });
  }

  async importAlternativeTitles(
    movieId: string,
    alternativeTitles: { title: string; country_code: string; type?: string }[],
  ): Promise<AlternativeTitle[]> {
    const movie = await this.movieRepository.findOne({ where: { id: movieId } });
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
}
