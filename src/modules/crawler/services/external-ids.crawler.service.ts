import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../movie/entities/movie.entity';
import api from '@/common/utils/axios.util';

@Injectable()
export class ExternalIdsCrawlerService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async importExternalIds(movie: Movie, tmdbId: number): Promise<Movie> {
    const { data } = await api.get<{
      imdb_id?: string;
      wikidata_id?: string;
      facebook_id?: string;
      instagram_id?: string;
      twitter_id?: string;
    }>(`/movie/${tmdbId}/external_ids`);
    movie.imdb_id = data.imdb_id ?? movie.imdb_id;
    movie.wikidata_id = data.wikidata_id ?? movie.wikidata_id;
    movie.facebook_id = data.facebook_id ?? movie.facebook_id;
    movie.instagram_id = data.instagram_id ?? movie.instagram_id;
    movie.twitter_id = data.twitter_id ?? movie.twitter_id;
    return this.movieRepository.save(movie);
  }
}
