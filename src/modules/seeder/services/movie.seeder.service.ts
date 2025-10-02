import { Movie } from "@/modules/movie/entities/movie.entity";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import pLimit from "p-limit";


const BATCH_SIZE = 10;

@Injectable()
export class MovieSeederService {
  private readonly logger: Logger = new Logger(MovieSeederService.name);
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {
    // this.seedMovieBudget();
  }

  async seedMovieBudget(): Promise<void> {
    const movies = await this.movieRepository.find();
    const limit = pLimit(BATCH_SIZE); // Limit concurrency to 5
    const batchTasks = movies.map((movie) => {
      return limit(async () => {
        const randomBudget = Math.floor(Math.random() * (200_000_000 - 1_000_000 + 1)) + 1_000_000;
        movie.budget = randomBudget;
        await this.movieRepository.save(movie);
        this.logger.log(`Set budget $${randomBudget} for movie ${movie.title}`);
      })
    })
    await Promise.all(batchTasks);

    await this.seedMoviePrice();
  }

  async seedMoviePrice(): Promise<void> {
    const movies = await this.movieRepository.find();
    const limit = pLimit(BATCH_SIZE); // Limit concurrency to 5
    const batchTasks = movies.map((movie) => {
      return limit(async () => {
        const price = Math.max(3.99, Math.min(19.99, movie.budget / 10_000_000));
        movie.price = parseFloat(price.toFixed(2));
        await this.movieRepository.save(movie);
        this.logger.log(`Set price $${movie.price} for movie ${movie.title}`);
      })
    })
    await Promise.all(batchTasks);
  }
}