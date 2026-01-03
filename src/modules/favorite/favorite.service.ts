import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { Movie } from '../movie/entities/movie.entity';
import { User } from '../user/user.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(Movie)
    private movieRepository: Repository<Movie>,
  ) {}

  /**
   * Toggle favorite status for a movie
   * If already favorited, remove it; otherwise, create new favorite
   *
   * @param userId - User ID from JWT
   * @param movieId - Movie UUID
   * @returns { isFavorite: boolean }
   */
  async toggleFavorite(
    userId: string,
    movieId: string,
  ): Promise<{ isFavorite: boolean }> {
    // Check if movie exists
    const movie = await this.movieRepository.findOne({
      where: { id: movieId },
    });

    if (!movie) {
      throw new NotFoundException(`Movie with ID ${movieId} not found`);
    }

    // Check if favorite already exists
    const existingFavorite = await this.favoriteRepository.findOne({
      where: {
        user: { id: userId },
        movie: { id: movieId },
      },
    });

    if (existingFavorite) {
      // Remove favorite
      await this.favoriteRepository.remove(existingFavorite);
      return { isFavorite: false };
    }

    // Create new favorite
    const favorite = this.favoriteRepository.create({
      user: { id: userId } as User,
      movie: { id: movieId } as Movie,
    });

    await this.favoriteRepository.save(favorite);
    return { isFavorite: true };
  }

  /**
   * Check if a movie is favorited by a user
   *
   * @param userId - User ID from JWT
   * @param movieId - Movie UUID
   * @returns { isFavorite: boolean }
   */
  async isFavorite(userId: string, movieId: string): Promise<boolean> {
    const favorite = await this.favoriteRepository.findOne({
      where: {
        user: { id: userId },
        movie: { id: movieId },
      },
    });

    return !!favorite;
  }

  /**
   * Get all favorite movies for a user
   *
   * @param userId - User ID from JWT
   * @returns Array of Movie IDs
   */
  async getUserFavorites(userId: string): Promise<string[]> {
    const favorites = await this.favoriteRepository.find({
      where: { user: { id: userId } },
      select: ['movie'],
      relations: ['movie'],
    });

    return favorites.map((f) => f.movie.id);
  }
}
