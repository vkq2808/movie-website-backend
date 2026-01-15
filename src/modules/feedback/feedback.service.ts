import { Injectable, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Feedback } from './feedback.entity';
import { User } from '../user/user.entity';
import { ResourcesNotFoundException, InternalServerErrorException } from '@/exceptions';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
  ) { }

  private sanitizeFeedback(feedback: Feedback) {
    if (!feedback) return feedback;
    const safeUser = feedback.user
      ? {
        id: feedback.user.id,
        username: (feedback.user as any).username,
        photo_url: (feedback.user as any).photo_url,
      }
      : null;

    return {
      id: feedback.id,
      feedback: feedback.feedback,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
      user: safeUser,
      movie: feedback.movie,
      status: (feedback as any).status || 'active',
    } as unknown as Feedback;
  }

  private sanitizeList(items: Feedback[]) {
    return items.map((i) => this.sanitizeFeedback(i));
  }

  async create(
    createFeedbackData: Partial<Feedback> & { user: User },
  ): Promise<Feedback> {
    // Prevent duplicate feedback by same user for same movie
    const existing = await this.feedbackRepository.findOne({
      where: {
        user: { id: createFeedbackData.user.id },
        movie: { id: (createFeedbackData.movie as any).id },
      },
    });
    if (existing) {
      throw new ConflictException('Feedback already exists for this movie');
    }

    const feedback = this.feedbackRepository.create(createFeedbackData);
    try {
      const saved = await this.feedbackRepository.save(feedback);
      return this.sanitizeFeedback(saved) as unknown as Feedback;
    } catch (error: any) {
      // Postgres unique violation code
      if (error && (error.code === '23505' || error.code === 'ER_DUP_ENTRY')) {
        throw new ConflictException('Feedback already exists for this movie');
      }
      throw new InternalServerErrorException('Failed to create feedback');
    }
  }

  async findAll(
    options: { skip?: number; take?: number } = {},
  ): Promise<[Feedback[], number]> {
    const { skip = 0, take = 10 } = options;
    const [items, count] = await this.feedbackRepository.findAndCount({
      skip,
      take,
      order: { created_at: 'DESC' },
      relations: ['user', 'movie'],
    });
    return [this.sanitizeList(items) as unknown as Feedback[], count];
  }

  /**
   * Find all feedbacks with pagination and filters (for admin use)
   * @param options - { skip, take, search, status }
   */
  async findAllPaginated(options: {
    skip?: number;
    take?: number;
    search?: string;
    status?: string;
  } = {}): Promise<[Feedback[], number]> {
    const { skip = 0, take = 10, search, status } = options;

    const query = this.feedbackRepository
      .createQueryBuilder('feedback')
      .leftJoinAndSelect('feedback.user', 'user')
      .leftJoinAndSelect('feedback.movie', 'movie')
      .orderBy('feedback.created_at', 'DESC');

    // Filter by status if provided
    if (status && status !== 'all') {
      query.andWhere('feedback.status = :status', { status });
    }

    // Search in user username or movie title
    if (search) {
      query.andWhere(
        '(LOWER(user.full_name) LIKE LOWER(:search) OR LOWER(movie.title) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    query.skip(skip).take(take);

    const [items, count] = await query.getManyAndCount();
    return [this.sanitizeList(items) as unknown as Feedback[], count];
  }

  async findById(id: string): Promise<Feedback | null> {
    const found = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    if (!found) return null;

    return this.sanitizeFeedback(found) as unknown as Feedback | null;
  }

  async findByUserId(userId: string): Promise<Feedback[]> {
    const items = await this.feedbackRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
      relations: ['user', 'movie'],
    });
    return this.sanitizeList(items) as unknown as Feedback[];
  }

  async findByMovieIdPaginated(
    movieId: string,
    options: { skip: number; take: number },
  ): Promise<[Feedback[], number]> {
    const [items, count] = await this.feedbackRepository.findAndCount({
      where: { movie: { id: movieId } },
      order: { created_at: 'DESC' },
      relations: ['user', 'movie'],
      skip: options.skip,
      take: options.take,
    });
    return [this.sanitizeList(items) as unknown as Feedback[], count];
  }

  /**
   * Update feedback with ownership check
   * @param id - Feedback ID
   * @param user - User making the request
   * @param isAdmin - Whether user is admin (bypasses ownership check)
   * @param update_data - Data to update
   */
  async update(
    id: string,
    user: User,
    isAdmin: boolean,
    update_data: Partial<Pick<Feedback, 'feedback'>>,
  ): Promise<Feedback | null> {
    const existing = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    if (!existing) {
      throw new ResourcesNotFoundException('Feedback not found');
    }

    // Ownership check: if not admin, only allow owner to update
    if (!isAdmin) {
      if (!existing.user || existing.user.id !== user.id) {
        throw new ForbiddenException('You cannot edit this feedback');
      }
    }

    await this.feedbackRepository.update(id, update_data);
    const updated = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    if (!updated) throw new ResourcesNotFoundException('Feedback not found');

    return this.sanitizeFeedback(updated) as unknown as Feedback;
  }

  /**
   * Delete feedback with ownership check
   * @param id - Feedback ID
   * @param user - User making the request
   * @param isAdmin - Whether user is admin (bypasses ownership check)
   */
  async delete(id: string, user: User, isAdmin: boolean): Promise<void> {
    const existing = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!existing) {
      throw new ResourcesNotFoundException('Feedback not found');
    }

    // Ownership check: if not admin, only allow owner to delete
    if (!isAdmin) {
      if (!existing.user || existing.user.id !== user.id) {
        throw new ForbiddenException('You cannot delete this feedback');
      }
    }

    await this.feedbackRepository.delete(id);
  }

  /**
   * Update feedback status (for admin use)
   * @param id - Feedback ID
   * @param status - New status ('active', 'hidden', 'deleted')
   */
  async updateStatus(
    id: string,
    status: 'active' | 'hidden' | 'deleted',
  ): Promise<Feedback> {
    const existing = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    if (!existing) {
      throw new ResourcesNotFoundException('Feedback not found');
    }

    await this.feedbackRepository.update(id, { status } as any);

    const updated = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    if (!updated) throw new ResourcesNotFoundException('Feedback not found');

    return this.sanitizeFeedback(updated) as unknown as Feedback;
  }

  /**
   * Delete feedback permanently (for admin use)
   * @param id - Feedback ID
   */
  async deleteByAdmin(id: string): Promise<void> {
    const existing = await this.feedbackRepository.findOne({
      where: { id },
    });
    if (!existing) {
      throw new ResourcesNotFoundException('Feedback not found');
    }

    await this.feedbackRepository.delete(id);
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.feedbackRepository.count();
    return { total };
  }
}
