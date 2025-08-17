import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly service: SettingsService) { }

  @Get()
  async getPublicSettings() {
    const data = await this.service.get();
    const { id, created_at, updated_at, contactEmail, maxFileSize, sessionTimeout, backupFrequency, logRetentionDays, ...publicData } = data as any;
    return ResponseUtil.success(publicData, 'Public settings retrieved successfully.');
  }
}
