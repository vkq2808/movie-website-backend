import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchProvider } from '../watch-provider.entity';
import { DEFAULT_PROVIDERS } from '../watch-provider.constants';

@Injectable()
export class WatchProviderService {
  private readonly logger: Logger = new Logger(WatchProviderService.name);
  private providerMap = new Map<string, WatchProvider>();
  constructor(
    @InjectRepository(WatchProvider)
    private readonly providerRepo: Repository<WatchProvider>,
  ) {}

  async getAllProviders(): Promise<WatchProvider[]> {
    if (this.providerMap.size === 0) {
      await this.hydrateProviderMap();
    }
    return Array.from(this.providerMap.values());
  }

  getProvider(slug: string): WatchProvider | undefined {
    return this.providerMap.get(slug);
  }

  // get youtube() {
  //   return this.getProvider('youtube');
  // }

  get r2() {
    return this.getProvider('r2');
  }

  async syncDefaultProviders(): Promise<{
    count: number;
    providers: Array<{ id: string; name: string; slug: string }>;
  }> {
    // await this.providerRepo.deleteAll();
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
    const providers = await this.hydrateProviderMap();

    return {
      count: providers.length,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
    };
  }

  private async hydrateProviderMap(): Promise<WatchProvider[]> {
    const providers = await this.providerRepo.find({
      order: {
        display_priority: 'ASC',
        name: 'ASC',
      },
    });

    this.providerMap.clear();
    providers.forEach((p) => this.providerMap.set(p.slug, p));

    return providers;
  }
}
