import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './image.entity';

@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
  ) {}

  async create(imageData: Partial<Image>): Promise<Image> {
    const image = this.imageRepository.create(imageData);
    return this.imageRepository.save(image);
  }

  async findById(id: string): Promise<Image | null> {
    return this.imageRepository.findOne({ where: { id } });
  }

  async update(id: string, imageData: Partial<Image>): Promise<Image | null> {
    await this.imageRepository.update(id, imageData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.imageRepository.delete(id);
  }

  async findByIds(ids: string[]): Promise<Image[]> {
    return this.imageRepository.findByIds(ids);
  }

  async createMany(images: Partial<Image>[]): Promise<Image[]> {
    const imageEntities = images.map((img) => this.imageRepository.create(img));
    return this.imageRepository.save(imageEntities);
  }
}
