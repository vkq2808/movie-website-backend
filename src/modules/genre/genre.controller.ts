import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { GenreService } from './genre.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('genre')
export class GenreController {
  constructor(private readonly genreService: GenreService) {}

  @Get('')
  async getGenres() {
    const genres = await this.genreService.getGenres();
    return ResponseUtil.success(genres, 'Genres retrieved successfully.');
  }

  @Post('')
  async createGenre(@Body() body) {
    const genre = await this.genreService.createGenre(body);
    return ResponseUtil.success(genre, 'Genre created successfully.');
  }

  @Put(':id')
  async updateGenre(@Param('id') id: string, @Body() body) {
    const genre = await this.genreService.updateGenre(id, body);
    return ResponseUtil.success(genre, 'Genre updated successfully.');
  }

  @Delete(':id')
  async deleteGenre(@Param('id') id: string) {
    await this.genreService.deleteGenre(id);
    return ResponseUtil.success(null, 'Genre deleted successfully.');
  }
}
