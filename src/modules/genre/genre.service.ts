import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from './genre.entity';
import api from '@/common/utils/axios.util';
import { modelNames } from '@/common/constants/model-name.constant';

@Injectable()
export class GenreService {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) { }

  /**
   * Lấy thể loại theo ID
   */
  async getById(id: string) {
    const genre = await this.genreRepository.findOne({
      where: { id }
    });
    if (!genre) throw new NotFoundException(`Genre with id ${id} not found`);
    return genre;
  }

  /**
   * Lấy tất cả thể loại (Genres)
   */
  async getGenres() {
    const genres = await this.genreRepository.find();
    return genres.map((genre) => ({
      id: genre.id,
      original_id: genre.original_id,
      names: genre.names.map((name) => ({
        name: name.name,
        iso_639_1: name.iso_639_1,
      })),
    }));
  }

  /**
   * Tạo mới một thể loại
   * @param data { names: [{ name, iso_639_1 }] }
   */
  async createGenre(data: { names: { name: string; iso_639_1: string }[] }) {
    const genre = this.genreRepository.create({
      names: data.names,
    });

    const saved = await this.genreRepository.save(genre);
    return {
      id: saved.id,
      names: saved.names,
    };
  }

  /**
   * Cập nhật thể loại theo id
   */
  async updateGenre(
    id: string,
    data: { names: { name: string; iso_639_1: string }[] },
  ) {
    const genre = await this.genreRepository.findOneBy({ id });
    if (!genre) throw new NotFoundException(`Genre with id ${id} not found`);

    genre.names = data.names;
    const updated = await this.genreRepository.save(genre);
    return {
      id: updated.id,
      names: updated.names,
    };
  }

  /**
   * Xóa thể loại theo id
   */
  async deleteGenre(id: string) {
    const genre = await this.genreRepository.findOneBy({ id });
    if (!genre) throw new NotFoundException(`Genre with id ${id} not found`);

    await this.genreRepository.remove(genre);
    return true;
  }

  /**
   * Xóa toàn bộ thể loại (cẩn trọng khi gọi)
   */
  async deleteAllGenres() {
    console.log('Deleting all genres from database...');
    await this.genreRepository.query(
      `TRUNCATE TABLE "${modelNames.GENRE}" CASCADE`,
    );
    console.log('Deleted all genres from database successfully');
  }

  /**
   * Đồng bộ lại toàn bộ genres từ TMDB (EN + VI)
   */
  async fetchAllGenres() {
    console.log('Fetching genres from API...');

    // Fetch English genres first as base
    const { data: enData } = await api.get<{
      genres: { id: number; name: string }[];
    }>('/genre/movie/list', {
      params: { language: 'en' },
    });
    console.log('Fetched English genres, total:', enData.genres.length);

    // Get Vietnamese genres for localization
    const { data: viData } = await api.get<{
      genres: { id: number; name: string }[];
    }>('/genre/movie/list', {
      params: { language: 'vi' },
    });
    console.log('Fetched Vietnamese genres, total:', viData.genres.length);

    // Clear existing genres
    await this.genreRepository.query(
      `TRUNCATE TABLE "${modelNames.GENRE}" CASCADE`,
    );

    // Create genres with both English and Vietnamese names
    const genresToSave = enData.genres.map((enGenre) => {
      const viGenre = viData.genres.find((g) => g.id === enGenre.id);
      return {
        original_id: enGenre.id,
        names: [
          { name: enGenre.name, iso_639_1: 'en' },
          ...(viGenre ? [{ name: viGenre.name, iso_639_1: 'vi' }] : []),
        ],
      };
    });

    await this.genreRepository.save(genresToSave);
    console.log('Inserted genres with multilingual support successfully');
  }

  async getGenreTrending() {
    return await this.genreRepository
      .createQueryBuilder('genre')
      .leftJoin('genre.movies', 'movie')
      .select('genre.names', 'names')
      .addSelect('COUNT(movie.id)', 'count')
      .groupBy('genre.id')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
  }
}
