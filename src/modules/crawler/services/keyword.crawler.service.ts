import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../movie/entities/movie.entity';
import { Keyword } from '../../keyword/keyword.entity';
import api from '@/common/utils/axios.util';

@Injectable()
export class KeywordCrawlerService {
  constructor(
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async importKeywords(movie: Movie, tmdbId: number): Promise<Keyword[]> {
    const { data } = await api.get<{
      keywords: { id: number; name: string }[];
    }>(`/movie/${tmdbId}/keywords`);
    const keywords: Keyword[] = [];
    for (const kw of data.keywords ?? []) {
      let entity = await this.keywordRepository.findOne({
        where: { original_id: kw.id },
      });
      if (!entity) {
        entity = this.keywordRepository.create({
          original_id: kw.id,
          name: kw.name,
        });
        entity = await this.keywordRepository.save(entity);
      }
      keywords.push(entity);
    }
    movie.keywords = Array.from(
      new Set([...(movie.keywords ?? []), ...keywords]),
    );
    await this.movieRepository.save(movie);
    return keywords;
  }
}
