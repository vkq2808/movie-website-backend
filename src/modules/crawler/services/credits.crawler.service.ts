import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../movie/entities/movie.entity';
import { MovieCast } from '../../movie/entities/movie-cast.entity';
import { MovieCrew } from '../../movie/entities/movie-crew.entity';
import { TMDBMovieCast, TMDBMovieCrew } from '../dtos/movie.dto';
import { Person } from '@/modules/person/person.entity';

@Injectable()
export class CreditsCrawlerService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(MovieCast)
    private readonly movieCastRepository: Repository<MovieCast>,
    @InjectRepository(MovieCrew)
    private readonly movieCrewRepository: Repository<MovieCrew>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  async importCreditsWithoutFetching(
    movie: Movie,
    cast: TMDBMovieCast[],
    crew: TMDBMovieCrew[],
  ) {
    for (let i = 0; i < cast.length; i++) {
      const c = cast[i];
      const person = this.personRepository.create({
        original_id: c.id,
        profile_url: c.profile_path
          ? `https://image.tmdb.org/t/p/w300${c.profile_path}`
          : undefined,
        name: c.name,
      });
      const entity = this.movieCastRepository.create({
        movie: { id: movie.id },
        person,
      });
      await this.movieCastRepository.save(entity);
    }

    for (let i = 0; i < crew.length; i++) {
      const cw = crew[i];
      const person = this.personRepository.create({
        original_id: cw.id,
        profile_url: cw.profile_path
          ? `https://image.tmdb.org/t/p/w300${cw.profile_path}`
          : undefined,
        name: cw.name,
      });
      const entity = this.movieCrewRepository.create({
        movie: { id: movie.id },
        person,
      });
      await this.movieCrewRepository.save(entity);
    }
  }
}
