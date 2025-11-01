import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';
import { WatchProvider } from '../watch-provider.entity';
import { AvailabilityType } from '@/common/enums';
import { DEFAULT_PROVIDERS } from '../watch-provider.constants';
import { R2Service } from './r2.service';

@Injectable()
export class WatchProviderService implements OnModuleInit {
  private readonly logger: Logger = new Logger(WatchProviderService.name)
  private providerMap = new Map<string, WatchProvider>();
  constructor(
    @InjectRepository(WatchProvider)
    private readonly providerRepo: Repository<WatchProvider>,
    private readonly r2Service: R2Service
  ) { }

  async onModuleInit() {
    const providers = await this.syncDefaultProviders();
    providers.forEach((p) => this.providerMap.set(p.slug, p));
  }

  getAllProviders() {
    return Array.from(this.providerMap).map(([k, v]) => v);
  }

  getProvider(slug: string): WatchProvider | undefined {
    return this.providerMap.get(slug);
  }

  get local() {
    return this.getProvider('local');
  }

  // get youtube() {
  //   return this.getProvider('youtube');
  // }

  get r2() {
    return this.getProvider('r2');
  }

  async syncDefaultProviders() {
    for (const providerData of DEFAULT_PROVIDERS) {
      let provider = await this.providerRepo.findOne({
        where: { slug: providerData.slug },
      });

      if (!provider) {
        // ✅ Chưa có → tạo mới
        this.logger.log(`Creating new provider: ${providerData.slug}`);
        provider = this.providerRepo.create(providerData);
        await this.providerRepo.save(provider);
      } else {
        // ✅ Đã có → cập nhật nếu khác
        const needsUpdate = Object.entries(providerData).some(
          ([key, value]) => provider?.[key] !== value,
        );

        if (needsUpdate) {
          this.logger.log(`Updating existing provider: ${provider.slug}`);
          Object.assign(provider, providerData);
          await this.providerRepo.save(provider);
        }
      }
    }

    this.logger.log('✅ Default providers synchronized.');
    return await this.providerRepo.find();
  }
}
