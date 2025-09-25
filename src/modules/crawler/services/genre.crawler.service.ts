import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from '../../genre/genre.entity';
import { Language } from '../../language/language.entity';
import api from '@/common/utils/axios.util';

@Injectable()
export class GenreCrawlerService {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async initializeGenresForLanguage(
    language: Language,
  ): Promise<Map<number, Genre>> {
    const genreMap = new Map<number, Genre>();
    try {
      const response = await api.get<{
        genres: { id: number; name: string }[];
      }>('/genre/movie/list', { params: { language: language.iso_639_1 } });
      const genres = response.data.genres;
      for (let i = 0; i < genres.length; i++) {
        const genre = genres[i];
        if (!genre.name?.trim()) {
          console.warn(`Empty genre name for ID ${genre.id}, skipping...`);
          continue;
        }
        const genreName = genre.name.trim();
        let savedGenre = await this.genreRepository.findOne({
          where: { original_id: genre.id },
        });
        if (!savedGenre) {
          const genreData = Genre.create(genreName, language.iso_639_1);
          savedGenre = this.genreRepository.create({
            ...genreData,
            original_id: genre.id,
          });
          savedGenre = await this.genreRepository.save(savedGenre);
        } else {
          const existingNameIndex = savedGenre.names.findIndex(
            (n) => n.iso_639_1 === language.iso_639_1,
          );
          if (existingNameIndex >= 0) {
            savedGenre.names[existingNameIndex].name = genreName;
          } else {
            savedGenre.names.push({
              name: genreName,
              iso_639_1: language.iso_639_1,
            });
          }
          savedGenre = await this.genreRepository.save(savedGenre);
        }
        genreMap.set(genre.id, savedGenre);
      }
    } catch (error) {
      console.error(
        `Failed to fetch genres for language ${language.iso_639_1}:`,
        error,
      );
    }
    return genreMap;
  }
}
