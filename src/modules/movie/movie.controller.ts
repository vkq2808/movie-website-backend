import { Controller, Get, Param, Post, Body, UseGuards, Query, Put } from "@nestjs/common";
import { MovieService } from "./movie.service";
import { JwtAuthGuard } from "../auth/strategy/jwt/jwt-auth.guard";
import { RolesGuard } from "@/common/role.guard";
import { Roles } from "@/common/role.decorator";
import { Role } from "@/common/enums/role.enum";
import { CreateMovieDto, UpdateMovieDto } from "./movie.dto";

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) { }

  @Get()
  async getMovies(@Query() query: any) {
    // Extract pagination parameters
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    // Remove pagination parameters from filters
    const { page: _, limit: __, ...filters } = query;

    // Use the new generic filtering method
    return this.movieService.getMovies(filters, page, limit);
  }

  @Get('slides')
  async getSlides(
    @Query('language') languageCode?: string,
    @Query('limit') limit?: string
  ) {
    const slideLimit = limit ? parseInt(limit) : 5;
    return this.movieService.getSlides(languageCode, slideLimit);
  }

  @Get(':id') async getMovieById(
    @Param('id') id: string,
    @Query('include_alternatives') includeAlternatives?: string
  ) {
    const shouldIncludeAlternatives = includeAlternatives !== 'false';
    return this.movieService.getMovieById(id, shouldIncludeAlternatives);
  }

  @Get(':id/alternative-titles')
  async getAlternativeTitles(@Param('id') id: string) {
    return this.movieService.getAlternativeTitles(id);
  }

  @Post(':id/import-alternative-titles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async importAlternativeTitles(
    @Param('id') id: string,
    @Body() body: { tmdbId: number }
  ) {
    return this.movieService.importAlternativeTitlesFromTMDB(id, body.tmdbId);
  }

  @Put(':id/update-alternative-titles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateAlternativeTitles(@Param('id') id: string) {
    return this.movieService.updateMovieWithAlternativeTitles(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async createMovie(@Body() movieData: CreateMovieDto) {
    return this.movieService.createMovie(movieData);
  } @Post(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateMovie(@Param('id') id: string, @Body() movieData: UpdateMovieDto) {
    return this.movieService.updateMovie(id, movieData);
  }

  @Post(':id/languages/add')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async addLanguageToMovie(
    @Param('id') id: string,
    @Body() body: { language_iso_code: string }
  ) {
    return this.movieService.addLanguageToMovie(id, body.language_iso_code);
  }

  @Post(':id/languages/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async removeLanguageFromMovie(
    @Param('id') id: string,
    @Body() body: { language_iso_code: string }
  ) {
    return this.movieService.removeLanguageFromMovie(id, body.language_iso_code);
  }
}
