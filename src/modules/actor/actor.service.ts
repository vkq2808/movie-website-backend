import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actor } from './actor.entity';

@Injectable()
export class ActorService {
  constructor(
    @InjectRepository(Actor)
    private readonly actorRepository: Repository<Actor>,
  ) { }

  async create(createActorData: Partial<Actor>): Promise<Actor> {
    const actor = this.actorRepository.create(createActorData);
    return this.actorRepository.save(actor);
  }

  async findAll(): Promise<Actor[]> {
    return this.actorRepository.find({
      relations: ['movies'],
    });
  }

  async findById(id: string): Promise<Actor | null> {
    return this.actorRepository.findOne({
      where: { id },
      relations: ['movies'],
    });
  }

  async update(
    id: string,
    updateActorData: Partial<Actor>,
  ): Promise<Actor | null> {
    await this.actorRepository.update(id, updateActorData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.actorRepository.delete(id);
  }

  async findByIds(ids: string[]): Promise<Actor[]> {
    return this.actorRepository.find({ where: ids.map((id) => ({ id })) });
  }

  async addMovieToActor(actorId: string, movieId: string): Promise<Actor> {
    const actor = await this.findById(actorId);
    if (!actor) {
      throw new Error('Actor not found');
    }

    const movieRef = {
      id: movieId,
    } as unknown as import('../movie/entities/movie.entity').Movie;
    actor.movies = [...(actor.movies || []), movieRef];
    return this.actorRepository.save(actor);
  }

  async removeMovieFromActor(actorId: string, movieId: string): Promise<Actor> {
    const actor = await this.findById(actorId);
    if (!actor) {
      throw new Error('Actor not found');
    }

    actor.movies = actor.movies.filter((movie) => movie.id !== movieId);
    return this.actorRepository.save(actor);
  }
}
