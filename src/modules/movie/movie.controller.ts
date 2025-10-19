import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  Query,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { MovieService } from './services/movie.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums/role.enum';
import { CreateMovieDto, UpdateMovieDto, MovieListQueryDto } from './movie.dto';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) { }

  @Get()
  async getMovies(@Query() query: MovieListQueryDto) {
    // Extract pagination parameters safely
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;

    // Remove pagination parameters from filters

    const { sort_by, sort_order, ...otherFilters } = query;

    // Validate and cast sort_by parameter to the expected union type
    const validSortByValues = [
      'release_date',
      'vote_average',
      'title',
      'vote_count',
      'popularity',
      'runtime',
      'price',
    ];
    const validatedSortBy =
      sort_by && validSortByValues.includes(sort_by)
        ? (sort_by as
          | 'release_date'
          | 'vote_average'
          | 'title'
          | 'vote_count'
          | 'popularity')
        : undefined;

    // Validate and cast sort_order parameter to the expected union type
    const validSortOrderValues = ['ASC', 'DESC'];
    const validatedSortOrder =
      sort_order && validSortOrderValues.includes(sort_order.toUpperCase())
        ? (sort_order.toUpperCase() as 'ASC' | 'DESC')
        : undefined;

    const filters = {
      ...otherFilters,
      ...(validatedSortBy && { sort_by: validatedSortBy }),
      ...(validatedSortOrder && { sort_order: validatedSortOrder }),
    };

    const result = await this.movieService.getMovies(filters, page, limit);
    return ResponseUtil.paginated(
      result.data,
      page,
      limit,
      result.meta.totalCount,
      'Movies retrieved successfully.',
    );
  }

  @Get(':id/poster')
  async getMoviePoster(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMoviePoster(id);
    console.log(result);
    return ResponseUtil.success(
      { poster_url: result },
      'Movie poster retrieved successfully.',
    );
  }
  @Get('slides')
  async getSlides(
    @Query('language') languageCode?: string,
    @Query('limit') limit?: string,
  ) {
    const slideLimit = limit ? parseInt(limit) : 5;
    const result = await this.movieService.getSlides(languageCode, slideLimit);
    return ResponseUtil.success(result, 'Slides retrieved successfully.');
  }

  // Admin movie management endpoints
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async getAdminMovies(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'all' | 'published' | 'draft',
  ) {
    const p = page ? parseInt(page) : 1;
    const l = limit ? parseInt(limit) : 10;
    const result = await this.movieService.getAdminMovies({
      page: p,
      limit: l,
      search,
      status,
    });
    return ResponseUtil.success(result, 'Admin movies retrieved successfully.');
  }

  @Get(':id') async getMovieById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieById(id);
    return ResponseUtil.success(result, 'Movie retrieved successfully.');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async createMovie(@Body() movieData: CreateMovieDto) {
    const result = await this.movieService.createMovie(movieData);
    return ResponseUtil.success(result, 'Movie created successfully.');
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateMovie(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() movieData: UpdateMovieDto,
  ) {
    const result = await this.movieService.updateMovie(id, movieData);
    return ResponseUtil.success(result, 'Movie updated successfully.');
  }


  @Post(':id/languages/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async removeLanguageFromMovie(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: { language_iso_code: string },
  ) {
    const result = await this.movieService.removeLanguageFromMovie(
      id,
      body.language_iso_code,
    );
    return ResponseUtil.success(
      result,
      'Language removed from movie successfully.',
    );
  }

  // Soft delete and restore endpoints
  @Post(':id/soft-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async softDeleteMovie(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.movieService.softDeleteMovie(id);
    return ResponseUtil.success(null, 'Movie soft-deleted successfully.');
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async restoreMovie(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.movieService.restoreMovie(id);
    return ResponseUtil.success(null, 'Movie restored successfully.');
  }
}
