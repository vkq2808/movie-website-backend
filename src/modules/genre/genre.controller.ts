import { Controller, Get } from '@nestjs/common';
import { GenreService } from './genre.service';

@Controller('genre')
export class GenreController {
  constructor(private readonly genreService: GenreService) {}

  @Get('')
  async getGenres() {
    return await this.genreService.getGenres();
  }
}
