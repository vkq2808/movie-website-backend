import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoviePurchase } from './movie-purchase.entity';
import { Movie } from '../movie/entities/movie.entity';
import { User } from '../user/user.entity';
import { WalletService } from '../wallet/wallet.service';
import {
  PurchaseMovieDto,
  MoviePurchaseResponseDto,
} from './movie-purchase.dto';
import {
  ResourcesNotFoundException,
  InternalServerErrorException,
} from '@/exceptions';

/**
 * ISSUE-06 BUSINESS ASSUMPTIONS
 *
 * This service handles movie purchases and related business logic.
 * Please note the following assumptions:
 *
 * 1. MoviePurchase Entity:
 *    - Current implementation assumes a simple purchase model with:
 *      * purchased_at: timestamp of purchase
 *      * purchase_price: price at time of purchase
 *      * No refund tracking (TODO: Add refund_status field)
 *      * No soft delete (TODO: Add deleted_at field if needed)
 *    - These fields should be added if business requirements change
 *
 * 2. Purchase Validity:
 *    - A purchase is considered valid if:
 *      * User ID + Movie ID combination exists in database
 *      * No expiration date checking (lifetime access assumed)
 *    - If temporal access is needed, add expiration_at field and adjust logic
 *
 * 3. Refund Logic:
 *    - Currently NOT IMPLEMENTED
 *    - TODO: Add refund_status enum (NONE, REQUESTED, APPROVED, COMPLETED)
 *    - TODO: Add refund_date field
 *    - When implemented, checkIfUserOwnMovie should check refund_status
 *
 * 4. Purchase History:
 *    - Old purchases are never deleted (soft or hard)
 *    - If purchase history cleanup is needed, use soft_delete (deleted_at)
 *
 * Future enhancements should follow this structure before modifying core logic.
 */
@Injectable()
export class MoviePurchaseService {
  constructor(
    @InjectRepository(MoviePurchase)
    private readonly moviePurchaseRepository: Repository<MoviePurchase>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly walletService: WalletService,
  ) {}

  async purchaseMovie(
    userId: string,
    purchaseMovieDto: PurchaseMovieDto,
  ): Promise<MoviePurchaseResponseDto> {
    try {
      // Check if user exists
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['wallet'],
      });

      if (!user) {
        throw new ResourcesNotFoundException('User not found');
      }

      // Check if movie exists
      const movie = await this.movieRepository.findOne({
        where: { id: purchaseMovieDto.movie_id },
      });

      if (!movie) {
        throw new ResourcesNotFoundException('Movie not found');
      }

      // Check if user already purchased this movie
      const existingPurchase = await this.moviePurchaseRepository.findOne({
        where: {
          user: { id: userId },
          movie: { id: purchaseMovieDto.movie_id },
        },
      });

      if (existingPurchase) {
        throw new ConflictException('Movie already purchased');
      }

      // Check if user has sufficient balance
      if (!user.wallet || Number(user.wallet.balance) < movie.price) {
        console.log(user);
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Deduct amount from user's wallet
      await this.walletService.deductBalance(userId, movie.price);

      // Create purchase record
      const purchase = this.moviePurchaseRepository.create({
        user,
        movie,
        purchase_price: movie.price,
        purchased_at: new Date(),
      });

      const savedPurchase = await this.moviePurchaseRepository.save(purchase);

      return {
        id: savedPurchase.id,
        movie_id: movie.id,
        movie_title: movie.title,
        purchase_price: savedPurchase.purchase_price,
        purchased_at: savedPurchase.purchased_at,
        movie_poster: movie.posters[0]?.url ?? '',
        movie_backdrop: movie.backdrops[0]?.url ?? '',
        created_at: savedPurchase.created_at,
      };
    } catch (error) {
      if (
        error instanceof ResourcesNotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to purchase movie');
    }
  }

  async getUserPurchases(userId: string): Promise<MoviePurchaseResponseDto[]> {
    try {
      const purchases = await this.moviePurchaseRepository.find({
        where: { user: { id: userId } },
        relations: ['movie'],
        order: { created_at: 'DESC' },
      });

      return purchases.map((purchase) => ({
        id: purchase.id,
        movie_id: purchase.movie.id,
        movie_title: purchase.movie.title,
        purchase_price: purchase.purchase_price,
        purchased_at: purchase.purchased_at,
        movie_poster: purchase.movie.posters[0]?.url ?? '',
        movie_backdrop: purchase.movie.backdrops[0]?.url ?? '',
        created_at: purchase.created_at,
      }));
    } catch {
      throw new InternalServerErrorException('Failed to fetch user purchases');
    }
  }

  async checkIfUserOwnMovie(userId: string, movieId: string): Promise<boolean> {
    try {
      if (!userId || !movieId) {
        throw new BadRequestException('User ID and Movie ID are required');
      }

      const purchase = await this.moviePurchaseRepository.findOne({
        where: {
          user: { id: userId },
          movie: { id: movieId },
        },
      });

      return !!purchase;
    } catch {
      return false;
    }
  }

  async getPurchaseDetails(
    userId: string,
    purchaseId: string,
  ): Promise<MoviePurchaseResponseDto> {
    try {
      const purchase = await this.moviePurchaseRepository.findOne({
        where: {
          id: purchaseId,
          user: { id: userId },
        },
        relations: ['movie'],
      });

      if (!purchase) {
        throw new ResourcesNotFoundException('Purchase not found');
      }

      return {
        id: purchase.id,
        movie_id: purchase.movie.id,
        movie_title: purchase.movie.title,
        purchase_price: purchase.purchase_price,
        purchased_at: purchase.purchased_at,
        movie_poster: purchase.movie.posters[0]?.url ?? '',
        movie_backdrop: purchase.movie.backdrops[0]?.url ?? '',
        created_at: purchase.created_at,
      };
    } catch (error) {
      if (error instanceof ResourcesNotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch purchase details',
      );
    }
  }
}
