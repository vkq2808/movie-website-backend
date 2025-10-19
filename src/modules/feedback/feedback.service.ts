import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Feedback } from './feedback.entity';
import { User } from '../user/user.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
  ) { }

  async create(
    createFeedbackData: Partial<Feedback> & { user: User },
  ): Promise<Feedback> {
    const feedback = this.feedbackRepository.create(createFeedbackData);
    return this.feedbackRepository.save(feedback);
  }

  async findAll(
    options: { skip?: number; take?: number } = {},
  ): Promise<[Feedback[], number]> {
    const { skip = 0, take = 10 } = options;
    return this.feedbackRepository.findAndCount({
      skip,
      take,
      order: { created_at: 'DESC' },
      relations: ['user', 'movie'],
    });
  }

  async findById(id: string): Promise<Feedback | null> {
    return this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'movie'],
    });
  }

  async findByUserId(userId: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
      relations: ['user', 'movie'],
    });
  }

  async findByMovieId(movieId: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { movie: { id: movieId } },
      order: { created_at: 'DESC' },
      relations: ['user', 'movie'],
    });
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
    return [items, count];
  }

  async update(
    id: string,
    update_data: Partial<Pick<Feedback, 'feedback'>>,
  ): Promise<Feedback | null> {
    await this.feedbackRepository.update(id, update_data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.feedbackRepository.delete(id);
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.feedbackRepository.count();
    return { total };
  }
}
