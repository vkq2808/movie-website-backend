import { Controller, Get } from "@nestjs/common";
import { MovieService } from "./movie.service";


@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) { }

  @Get('slides')
  async getSlides() {
    return this.movieService.getSlides()
  }
}