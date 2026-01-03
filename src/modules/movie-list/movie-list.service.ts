import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { validate as isUUID } from 'uuid';
import { MovieList, Visibility } from './entities/movie-list.entity';
import { MovieListItem } from './entities/movie-list-item.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { User } from '@/modules/user/user.entity';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { Role } from '@/common/enums/role.enum';

const MAX_MOVIES_PER_LIST = 100;

@Injectable()
export class MovieListService {
  constructor(
    @InjectRepository(MovieList)
    private readonly listRepo: Repository<MovieList>,
    @InjectRepository(MovieListItem)
    private readonly itemRepo: Repository<MovieListItem>,
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  private _buildListQuery(): SelectQueryBuilder<MovieList> {
    return this.listRepo
      .createQueryBuilder('list')
      .leftJoinAndSelect('list.user', 'user')
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(item.id)')
            .from(MovieListItem, 'item')
            .where('item.list_id = list.id'),
        'movies_count',
      )
      .loadRelationCountAndMap('list.moviesCount', 'list.items');
  }

  private _mapList(list: any): any {
    if (!list) return list;
    const moviesCount = list.moviesCount ? Number(list.moviesCount) : 0;
    // The user object is nested under 'user'. We can keep it that way.
    return { ...list, moviesCount };
  }

  async create(userId: string, dto: CreateListDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const list = this.listRepo.create({
      name: dto.name,
      description: dto.description,
      visibility: dto.visibility ?? Visibility.PRIVATE,
      user,
    });
    return this.listRepo.save(list);
  }

  async findMine(userId: string) {
    const lists = await this._buildListQuery()
      .where('list.user_id = :userId', { userId })
      .orderBy('list.updated_at', 'DESC')
      .getMany();
    return lists.map(this._mapList);
  }

  async findById(id: string, requestingUser?: { id?: string; role?: string }) {
    // Validate UUID format at service layer as additional safety
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid list ID format');
    }

    const list = await this._buildListQuery()
      .leftJoinAndSelect('list.items', 'items')
      .leftJoinAndSelect('items.movie', 'movie')
      .where('list.id = :id', { id })
      .getOne();

    if (!list) throw new NotFoundException('List not found');

    if (list.visibility === Visibility.PRIVATE) {
      const isOwner = requestingUser?.id && requestingUser.id === list.user.id;
      const isAdmin =
        requestingUser?.role &&
        requestingUser.role.toUpperCase() === Role.Admin;
      if (!isOwner && !isAdmin) throw new ForbiddenException('List is private');
    }

    return this._mapList(list);
  }

  async update(id: string, userId: string, dto: UpdateListDto) {
    // Validate UUID format
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid list ID format');
    }

    const list = await this.listRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.user.id !== userId) throw new ForbiddenException('Not owner');
    Object.assign(list, dto);
    return this.listRepo.save(list);
  }

  async softRemove(id: string, userId: string) {
    // Validate UUID format
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid list ID format');
    }

    const list = await this.listRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.user.id !== userId) throw new ForbiddenException('Not owner');
    return this.listRepo.softRemove(list);
  }

  async addMovie(
    listId: string,
    userId: string,
    movieId: string,
    position?: number,
  ) {
    // Validate UUID formats
    if (!isUUID(listId)) {
      throw new BadRequestException('Invalid list ID format');
    }
    if (!isUUID(movieId)) {
      throw new BadRequestException('Invalid movie ID format');
    }

    const list = await this.listRepo.findOne({
      where: { id: listId },
      relations: ['user', 'items'],
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.user.id !== userId) throw new ForbiddenException('Not owner');

    if (list.items && list.items.length >= MAX_MOVIES_PER_LIST) {
      throw new BadRequestException(
        `List cannot have more than ${MAX_MOVIES_PER_LIST} movies`,
      );
    }

    const movie = await this.movieRepo.findOne({
      where: { id: movieId },
      withDeleted: false,
    });
    if (!movie) throw new NotFoundException('Movie not found or deleted');

    const existing = await this.itemRepo.findOne({
      where: { list: { id: listId }, movie: { id: movieId } },
    });
    if (existing) throw new BadRequestException('Movie already in list');

    const item = this.itemRepo.create({ list, movie, position });
    return this.itemRepo.save(item);
  }

  // Create a list and add a movie atomically
  async createAndAdd(userId: string, dto: any) {
    // dto: { name, description?, visibility?, movieId, position? }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(MovieList);
      const itemRepo = manager.getRepository(MovieListItem);
      const movieRepo = manager.getRepository(Movie);

      const list = listRepo.create({
        name: dto.name,
        description: dto.description,
        visibility: dto.visibility ?? Visibility.PRIVATE,
        user,
      });
      const savedList = await listRepo.save(list);

      const movie = await movieRepo.findOne({
        where: { id: dto.movieId },
        withDeleted: false,
      });
      if (!movie) throw new NotFoundException('Movie not found or deleted');

      const item = itemRepo.create({
        list: savedList,
        movie,
        position: dto.position,
      });
      await itemRepo.save(item);

      return savedList;
    });
  }

  async removeMovie(listId: string, userId: string, movieId: string) {
    // Validate UUID formats
    if (!isUUID(listId)) {
      throw new BadRequestException('Invalid list ID format');
    }
    if (!isUUID(movieId)) {
      throw new BadRequestException('Invalid movie ID format');
    }

    const list = await this.listRepo.findOne({
      where: { id: listId },
      relations: ['user'],
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.user.id !== userId) throw new ForbiddenException('Not owner');

    const item = await this.itemRepo.findOne({
      where: { list: { id: listId }, movie: { id: movieId } },
    });
    if (!item) throw new NotFoundException('Movie not in list');
    return this.itemRepo.remove(item);
  }

  async publicLists(page = 1, limit = 20) {
    const qb = this._buildListQuery()
      .where('list.visibility = :visibility', {
        visibility: Visibility.PUBLIC,
      })
      .orderBy('list.created_at', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    const [items, count] = await qb.getManyAndCount();
    console.log(items, count);
    return {
      data: items.map(this._mapList),
      meta: { page, limit, total: count },
    };
  }

  async publicListsByUser(userId: string, page = 1, limit = 20) {
    // Validate UUID format
    if (!isUUID(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const qb = this._buildListQuery()
      .where('list.visibility = :visibility', {
        visibility: Visibility.PUBLIC,
      })
      .andWhere('list.user_id = :userId', { userId })
      .orderBy('list.created_at', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    const [items, count] = await qb.getManyAndCount();
    return {
      data: items.map(this._mapList),
      meta: { page, limit, total: count },
    };
  }

  async recommendedLists(userId: string, page = 1, limit = 20) {
    // Get user's favorite genres and languages
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['favorite_movies', 'favorite_movies.genres'],
    });

    if (!user || !user.favorite_movies || user.favorite_movies.length === 0) {
      // Fallback to popular public lists if user has no favorites
      return this.publicLists(page, limit);
    }

    // Extract genre IDs from user's favorite movies
    const genreIds = new Set<string>();
    user.favorite_movies.forEach((movie) => {
      movie.genres?.forEach((genre) => genreIds.add(genre.id));
    });

    const genreArray = Array.from(genreIds);

    if (genreArray.length === 0) {
      return this.publicLists(page, limit);
    }

    // Find public lists that contain movies with matching genres
    const qb = this._buildListQuery()
      .leftJoin('list.items', 'items')
      .leftJoin('items.movie', 'movie')
      .leftJoin('movie.genres', 'genres')
      .where('list.visibility = :visibility', {
        visibility: Visibility.PUBLIC,
      })
      .andWhere('list.user_id != :userId', { userId })
      .andWhere('genres.id IN (:...genreIds)', { genreIds: genreArray })
      .groupBy('list.id')
      .addGroupBy('user.id')
      .orderBy('COUNT(DISTINCT genres.id)', 'DESC')
      .addOrderBy('list.updated_at', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    const [items, count] = await qb.getManyAndCount();
    return {
      data: items.map(this._mapList),
      meta: { page, limit, total: count },
    };
  }
}
