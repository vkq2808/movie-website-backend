import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WatchProviderService } from './services/watch-provider.service';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums';
import { ResponseUtil } from '@/common';

@Controller('watch-provider')
export class WatchProviderController {
  constructor(private readonly watchProviderService: WatchProviderService) { }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  getAllProviders() {
    return ResponseUtil.success(this.watchProviderService.getAllProviders());
  }
}
