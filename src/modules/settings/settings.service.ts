import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettingsEntity } from './settings.entity';
import { UpdateSettingsDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSettingsEntity)
    private readonly repo: Repository<SystemSettingsEntity>,
  ) {}

  async get(): Promise<SystemSettingsEntity> {
    let current = await this.repo.findOne({ where: {} });
    if (!current) {
      current = this.repo.create({});
      await this.repo.save(current);
    }
    return current;
  }

  async update(payload: UpdateSettingsDto): Promise<SystemSettingsEntity> {
    const current = await this.get();
    const next = this.repo.merge(current, payload);
    return this.repo.save(next);
  }
}
