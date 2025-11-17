import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './settings.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';

@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async getSettings() {
    const data = await this.service.get();
    const publicData = {
      siteName: data.siteName,
      siteDescription: data.siteDescription,
      contactEmail: data.contactEmail,
      maintenanceMode: data.maintenanceMode,
      registrationEnabled: data.registrationEnabled,
      emailNotifications: data.emailNotifications,
      pushNotifications: data.pushNotifications,
      defaultLanguage: data.defaultLanguage,
      maxFileSize: data.maxFileSize,
      sessionTimeout: data.sessionTimeout,
      enableAnalytics: data.enableAnalytics,
      backupFrequency: data.backupFrequency,
      logRetentionDays: data.logRetentionDays,
    };
    return ResponseUtil.success(publicData, 'Settings retrieved successfully.');
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateSettings(@Body() body: UpdateSettingsDto) {
    const data = await this.service.update(body);
    const publicData = {
      siteName: data.siteName,
      siteDescription: data.siteDescription,
      contactEmail: data.contactEmail,
      maintenanceMode: data.maintenanceMode,
      registrationEnabled: data.registrationEnabled,
      emailNotifications: data.emailNotifications,
      pushNotifications: data.pushNotifications,
      defaultLanguage: data.defaultLanguage,
      maxFileSize: data.maxFileSize,
      sessionTimeout: data.sessionTimeout,
      enableAnalytics: data.enableAnalytics,
      backupFrequency: data.backupFrequency,
      logRetentionDays: data.logRetentionDays,
    };
    return ResponseUtil.success(publicData, 'Settings updated successfully.');
  }
}
