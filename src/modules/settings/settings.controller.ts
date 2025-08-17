import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './settings.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums/role.enum';

@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) { }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async getSettings() {
    const data = await this.service.get();
    // Strip server fields before returning
    const { id, created_at, updated_at, ...publicData } = data as any;
    return ResponseUtil.success(publicData, 'Settings retrieved successfully.');
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateSettings(@Body() body: UpdateSettingsDto) {
    const data = await this.service.update(body);
    const { id, created_at, updated_at, ...publicData } = data as any;
    return ResponseUtil.success(publicData, 'Settings updated successfully.');
  }
}

