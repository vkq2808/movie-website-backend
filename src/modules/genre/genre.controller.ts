import { Controller, Get } from '@nestjs/common';
import { GenreService } from './genre.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('genre')
export class GenreController {
  constructor(private readonly genreService: GenreService) { }

  @Get('')
  async getGenres() {
    const genres = await this.genreService.getGenres();
    return ResponseUtil.success(genres, 'Genres retrieved successfully.');
  }
}
