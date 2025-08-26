import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  async getPublicSettings() {
    const data = await this.service.get();
    const publicData = {
      siteName: data.siteName,
      siteDescription: data.siteDescription,
      maintenanceMode: data.maintenanceMode,
      registrationEnabled: data.registrationEnabled,
      emailNotifications: data.emailNotifications,
      pushNotifications: data.pushNotifications,
      defaultLanguage: data.defaultLanguage,
      enableAnalytics: data.enableAnalytics,
    };
    return ResponseUtil.success(
      publicData,
      'Public settings retrieved successfully.',
    );
  }
}
