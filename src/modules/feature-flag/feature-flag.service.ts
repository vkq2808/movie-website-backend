import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, FeatureFlagType } from './entities/feature-flag.entity';
import { RedisService } from '@/modules/redis/redis.service';
import { TokenPayload } from '@/common/token-payload.type';

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly CACHE_PREFIX = 'feature_flag:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepo: Repository<FeatureFlag>,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Load all feature flags into cache on startup
    await this.loadAllIntoCache();
  }

  private async loadAllIntoCache() {
    try {
      const flags = await this.featureFlagRepo.find();
      for (const flag of flags) {
        await this.redisService.set(
          `${this.CACHE_PREFIX}${flag.key}`,
          flag,
          this.CACHE_TTL,
        );
      }
    } catch (error) {
      console.error('Failed to load feature flags into cache:', error);
    }
  }

  async get(key: string): Promise<FeatureFlag | null> {
    // Try cache first
    const cached = await this.redisService.get<FeatureFlag>(
      `${this.CACHE_PREFIX}${key}`,
    );
    if (cached) return cached;

    // Fallback to DB
    const flag = await this.featureFlagRepo.findOne({ where: { key } });
    if (flag) {
      await this.redisService.set(
        `${this.CACHE_PREFIX}${key}`,
        flag,
        this.CACHE_TTL,
      );
    }
    return flag;
  }

  async getValue<T = any>(key: string, defaultValue?: T): Promise<T> {
    const flag = await this.get(key);
    if (!flag) return defaultValue as T;

    switch (flag.type) {
      case FeatureFlagType.BOOLEAN:
        return (flag.value === 'true') as T;
      case FeatureFlagType.NUMBER:
        return parseFloat(flag.value) as T;
      case FeatureFlagType.JSON:
        return JSON.parse(flag.value) as T;
      case FeatureFlagType.STRING:
      default:
        return flag.value as T;
    }
  }

  async isEnabled(key: string): Promise<boolean> {
    return (await this.getValue<boolean>(key, false)) ?? false;
  }

  async findAll() {
    return this.featureFlagRepo.find({
      order: { key: 'ASC' },
      relations: ['updated_by'],
    });
  }

  async createOrUpdate(
    key: string,
    type: FeatureFlagType,
    value: string,
    description?: string,
    updatedBy?: TokenPayload,
  ): Promise<FeatureFlag> {
    let flag = await this.featureFlagRepo.findOne({ where: { key } });

    if (flag) {
      flag.type = type;
      flag.value = value;
      flag.description = description || flag.description;
      flag.updated_by_id = updatedBy?.sub;
    } else {
      flag = this.featureFlagRepo.create({
        key,
        type,
        value,
        description,
        updated_by_id: updatedBy?.sub,
      });
    }

    const saved = await this.featureFlagRepo.save(flag);

    // Update cache
    await this.redisService.set(
      `${this.CACHE_PREFIX}${key}`,
      saved,
      this.CACHE_TTL,
    );

    return saved;
  }

  async delete(key: string): Promise<void> {
    await this.featureFlagRepo.delete({ key });
    await this.redisService.del(`${this.CACHE_PREFIX}${key}`);
  }
}

