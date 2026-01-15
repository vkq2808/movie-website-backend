import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Role } from '@/common/enums/role.enum';
import {
  AdminListUsersQueryDto,
  AdminUpdateUserDto,
  UpdateProfileDto,
} from './user.dto';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { Genre } from '@/modules/genre/genre.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepo: Repository<Genre>,
  ) {}

  async findById(id: string) {
    return this.userRepo.findOneBy({ id });
  }

  async listUsers(query: AdminListUsersQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> = {};
    if (query.search) {
      where.username = ILike(`%${query.search}%`);
    }
    if (query.role && query.role !== 'all') {
      where.role = query.role === 'admin' ? Role.Admin : Role.Customer;
    }
    if (query.status && query.status !== 'all') {
      where.is_active = query.status === 'active';
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    const mapped = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role === Role.Admin ? 'admin' : 'user',
      status: u.is_active ? 'active' : 'inactive',
      created_at: u.created_at?.toISOString?.() ?? String(u.created_at),
      last_login: undefined,
      avatar_url: u.photo_url ?? undefined,
      total_purchases: 0,
      total_watch_time: 0,
    }));

    return {
      users: mapped,
      total,
      page,
      limit,
      hasMore: total > skip + mapped.length,
    };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new Error('User not found');
    if (dto.role) {
      user.role = dto.role === 'admin' ? Role.Admin : Role.Customer;
    }
    if (dto.status) {
      user.is_active = dto.status === 'active';
    }
    await this.userRepo.save(user);
    return user;
  }

  async deleteUser(id: string) {
    await this.userRepo.delete({ id });
    return { success: true };
  }

  /**
   * Get current user profile with favorites
   */
  async getMe(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: [
        'favorites',
        'favorites.genres',
        'favorites.posters',
        'favorites.backdrops',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role === Role.Admin ? 'admin' : 'user',
      birthdate: user.birthdate
        ? user.birthdate.toISOString().split('T')[0]
        : null,
      photo_url: user.photo_url || null,
      is_verified: user.is_verified,
      is_active: user.is_active,
      has_submitted_favorite_genres: user.has_submitted_favorite_genres,
      favoriteMovies: user.favorites || [],
      created_at: user.created_at.toISOString(),
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if username is being changed and if it's already taken
    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.userRepo.findOne({
        where: { username: dto.username },
      });
      if (existingUser) {
        throw new ConflictException('Username already taken');
      }
      user.username = dto.username;
    }

    // Update birthdate if provided
    if (dto.birthdate) {
      user.birthdate = new Date(dto.birthdate);
    }

    await this.userRepo.save(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      birthdate: user.birthdate
        ? user.birthdate.toISOString().split('T')[0]
        : null,
      photo_url: user.photo_url || null,
    };
  }

  /**
   * Get user's favorite movies
   */
  async getFavorites(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['favorites', 'favorites.movie'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.favorites.map((fav) => fav.movie) || [];
  }
  /**
   * Submit user's favorite genres
   */
  async submitFavoriteGenres(userId: string, genreIds: string[]) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['favorite_genres'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // if (user.has_submitted_favorite_genres) {
    //   throw new ConflictException('User has already submitted favorite genres');
    // }

    if (genreIds.length === 0) {
      throw new ConflictException('At least one genre must be selected');
    }

    const genres = await this.genreRepo.findByIds(genreIds);
    if (genres.length !== genreIds.length) {
      throw new NotFoundException('Some genres not found');
    }

    user.favorite_genres = genres;
    user.has_submitted_favorite_genres = true;

    await this.userRepo.save(user);

    return { success: true, message: 'Favorite genres submitted successfully' };
  }
}
