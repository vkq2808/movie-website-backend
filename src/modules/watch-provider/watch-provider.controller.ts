import { Controller, Get, Post } from '@nestjs/common';
import { WatchProviderService } from './watch-provider.service';

@Controller('watch-providers')
export class WatchProviderController {
  constructor(
    private readonly watchProviderService: WatchProviderService,
  ) { }

  @Get('providers')
  async getAllProviders() {
    const providers = await this.watchProviderService.findAllProviders();
    return {
      success: true,
      data: providers,
      message: 'Watch providers retrieved successfully',
    };
  }

  @Post('providers/initialize')
  async initializeDefaultProviders() {
    const providers = await this.watchProviderService.initializeDefaultProviders();
    return {
      success: true,
      data: {
        count: providers.length,
        providers: providers.map(p => ({
          id: p.id,
          name: p.provider_name,
          slug: p.slug
        }))
      },
      message: `Successfully initialized ${providers.length} default watch providers`,
    };
  }
}