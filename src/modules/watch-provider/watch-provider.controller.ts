import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WatchProviderService } from './services/watch-provider.service';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums';
import { ResponseUtil } from '@/common';

@Controller('watch-provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class WatchProviderController {
  constructor(private readonly watchProviderService: WatchProviderService) {}

  @Get()
  async getAllProviders() {
    const providers = await this.watchProviderService.getAllProviders();
    return ResponseUtil.success(providers, 'Watch providers retrieved successfully');
  }

  @Post('initialize')
  async initializeProviders() {
    const result = await this.watchProviderService.syncDefaultProviders();
    return ResponseUtil.success(result, 'Watch providers synchronized successfully');
  }
}
