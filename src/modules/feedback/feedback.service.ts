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
        fullName: (feedback.user as any).fullName,
        avatar: (feedback.user as any).avatar,
      }
      : null;

    return {
      id: feedback.id,
      feedback: feedback.feedback,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
      user: safeUser,
      movie: feedback.movie,
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

  async findById(id: string): Promise<Feedback | null> {
    const found = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
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

  async update(
    id: string,
    userId: string,
    update_data: Partial<Pick<Feedback, 'feedback'>>,
  ): Promise<Feedback | null> {
    const existing = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    if (!existing) {
      throw new ResourcesNotFoundException('Comment not found');
    }
    // Ownership check: only the feedback owner may update
    if (!existing.user || existing.user.id !== userId) {
      throw new ForbiddenException('You cannot edit this comment');
    }
    await this.feedbackRepository.update(id, update_data);
    const updated = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
    return this.sanitizeFeedback(updated) as unknown as Feedback;
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!existing) {
      throw new ResourcesNotFoundException('Comment not found');
    }
    // Ownership check: only the feedback owner may delete
    if (!existing.user || existing.user.id !== userId) {
      throw new ForbiddenException('You cannot delete this comment');
    }
    await this.feedbackRepository.delete(id);
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.feedbackRepository.count();
    return { total };
  }
}
