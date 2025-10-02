// count-token.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { encoding_for_model, TiktokenModel } from 'tiktoken';
import { Movie } from '@/modules/movie/entities/movie.entity';

@Injectable()
export class CountTokenService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
  ) { }

  /**
   * Tạo text từ một movie
   */
  private buildMovieText(movie: Movie): string {
    let { title, overview, cast, crew, price } = movie;
    const filteredCast = cast?.sort((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0)).slice(0, 5).map(c => c.person.name);

    return `
      Title: ${title}
      Overview: ${overview ?? ''}
      Cast: ${(filteredCast ?? []).join(', ')}
      Crew: ${(crew ?? []).join(', ')}
      Price: ${price ?? ''}
    `;
  }

  /**
   * Đếm token của một movie
   */
  countTokensForMovie(movie: Movie, model: TiktokenModel = 'text-embedding-3-small'): number {
    const text = this.buildMovieText(movie);

    // dùng tiktoken encoder theo model OpenAI
    const encoder = encoding_for_model(model);
    const tokens = encoder.encode(text);

    encoder.free(); // giải phóng bộ nhớ
    return tokens.length;
  }

  /**
   * Đếm token cho toàn bộ movies
   */
  async countTokensForAllMovies(model: TiktokenModel = 'text-embedding-3-small') {
    const movies = await this.movieRepo.createQueryBuilder('movie')
      .innerJoinAndSelect('movie.cast', 'cast')
      .innerJoinAndSelect('movie.crew', 'crew')
      .getMany();
    let totalTokens = 0;

    const result = movies.map((movie) => {
      const tokens = this.countTokensForMovie(movie, model);
      totalTokens += tokens;
      return {
        id: movie.id,
        title: movie.title,
        tokens,
      };
    });

    return {
      totalTokens,
      details: result,
    };
  }
}
