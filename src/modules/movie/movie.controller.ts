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
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { CreateMovieDto, UpdateMovieDto, MovieListQueryDto } from './movie.dto';
import {
  MovieProductionCompaniesResponseDto,
  MovieProductionCompanyResponseDto,
} from './dtos/movie-production-company.response.dto';
import {
  MovieCrewResponseDto,
  MovieCrewMemberResponseDto,
} from './dtos/movie-crew.response.dto';
import {
  MovieCastResponseDto,
  MovieCastMemberResponseDto,
} from './dtos/movie-cast.response.dto';
import {
  MovieKeywordsResponseDto,
  MovieKeywordResponseDto,
} from './dtos/movie-keyword.response.dto';
import {
  MovieSpokenLanguagesResponseDto,
  MovieSpokenLanguageResponseDto,
} from './dtos/movie-spoken-language.response.dto';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

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

  @Get(':id')
  async getMovieById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    // Get only essential movie data
    const result = await this.movieService.getMovieBasicInfo(id);
    return ResponseUtil.success(
      result,
      'Movie basic info retrieved successfully.',
    );
  }

  @Get(':id/full')
  async getMovieFull(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    // Keep the full data endpoint for admin/backend uses
    const result = await this.movieService.getMovieById(id);
    return ResponseUtil.success(
      result,
      'Full movie data retrieved successfully.',
    );
  }

  @Get(':id/cast')
  async getMovieCast(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieCast(id);
    const response: MovieCastResponseDto = {
      movie_id: id,
      cast: result.map((cast) => ({
        id: cast.id,
        character: cast.character,
        order: cast.order,
        credit_id: cast.credit_id,
        person: {
          id: cast.person.id,
          name: cast.person.name,
          gender: cast.person.gender,
          adult: cast.person.adult,
          profile_image: cast.person.profile_image,
        },
      })) as MovieCastMemberResponseDto[],
    };
    return ResponseUtil.success(response, 'Movie cast retrieved successfully.');
  }

  @Get(':id/crew')
  async getMovieCrew(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieCrew(id);
    const response: MovieCrewResponseDto = {
      movie_id: id,
      crew: result.map((crew) => ({
        id: crew.id,
        department: crew.department,
        job: crew.job,
        order: crew.order,
        credit_id: crew.credit_id,
        person: {
          id: crew.person.id,
          name: crew.person.name,
          gender: crew.person.gender,
          adult: crew.person.adult,
          profile_image: crew.person.profile_image,
        },
      })) as MovieCrewMemberResponseDto[],
    };
    return ResponseUtil.success(response, 'Movie crew retrieved successfully.');
  }

  @Get(':id/production-companies')
  async getMovieProductionCompanies(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieProductionCompanies(id);
    const response: MovieProductionCompaniesResponseDto = {
      movie_id: id,
      production_companies: result as MovieProductionCompanyResponseDto[],
    };
    return ResponseUtil.success(
      response,
      'Movie production companies retrieved successfully.',
    );
  }

  @Get(':id/keywords')
  async getMovieKeywords(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieKeywords(id);
    const response: MovieKeywordsResponseDto = {
      movie_id: id,
      keywords: result as MovieKeywordResponseDto[],
    };
    return ResponseUtil.success(
      response,
      'Movie keywords retrieved successfully.',
    );
  }

  @Get(':id/spoken-languages')
  async getMovieSpokenLanguages(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieSpokenLanguages(id);
    const response: MovieSpokenLanguagesResponseDto = {
      movie_id: id,
      spoken_languages: result as MovieSpokenLanguageResponseDto[],
    };
    return ResponseUtil.success(
      response,
      'Movie spoken languages retrieved successfully.',
    );
  }

  @Get(':id/genres')
  async getMovieGenres(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await this.movieService.getMovieGenres(id);
    return ResponseUtil.success(result, 'Movie genres retrieved successfully.');
  }

  @Get(':id/videos')
  async getMovieVideos(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const videos = await this.movieService.getMovieVideos(id);
    return ResponseUtil.success(videos, 'Movie videos retrieved successfully.');
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
