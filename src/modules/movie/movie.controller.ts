import { Controller, Get, Param, Post, Body, UseGuards, Query } from "@nestjs/common";
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
  async getMovies(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('language') language?: string
  ) {
    if (language) {
      // If language parameter is provided, filter by language
      return this.movieService.getMoviesByLanguage(language, +page, +limit);
    }

    return this.movieService.getMoviesWithAlternativeTitles(+page, +limit);
  }

  @Get('slides')
  async getSlides() {
    return this.movieService.getSlides();
  }

  @Get(':id')
  async getMovieById(@Param('id') id: string) {
    // Get the movie and its alternative titles
    const movie = await this.movieService.getMovieById(id);
    const alternativeTitles = await this.movieService.getAlternativeTitles(id);

    return {
      ...movie,
      alternativeTitles
    };
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

  @Post(':id/update-alternative-titles')
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
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateMovie(@Param('id') id: string, @Body() movieData: UpdateMovieDto) {
    // First retrieve the existing movie
    const existingMovie = await this.movieService.getMovieById(id);

    // Update the movie
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
