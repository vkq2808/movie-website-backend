import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Keyword } from './keyword.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class KeywordService {
  constructor(
    @InjectRepository(Keyword)
    private readonly keywordRepo: Repository<Keyword>,
  ) {}

  async getById(id: string) {
    return this.keywordRepo.findOneBy({ id });
  }

  /**
   * Tìm kiếm keyword theo tên (sử dụng GIN index)
   * @param query Chuỗi cần tìm (ví dụ "action")
   * @param limit Giới hạn kết quả
   */
  async searchKeywords(query: string, limit = 10): Promise<Keyword[]> {
    if (!query || query.trim() === '') return [];

    return this.keywordRepo
      .createQueryBuilder('k')
      .select(['k.id', 'k.name'])
      .where('k.name ILIKE :name', { name: `%${query}%` })
      .orderBy('k.name', 'ASC')
      .limit(limit)
      .getMany();
  }
}
