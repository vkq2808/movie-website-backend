import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { ResponseUtil } from '@/common/utils/response.util';
import { AdminService } from './admin.service';
import { CreateAdminWatchPartyDto } from './dto/create-admin-watch-party.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    try {
      const stats = await this.adminService.getStats();
      return ResponseUtil.success(stats, 'Admin stats retrieved successfully');
    } catch (error) {
      console.error('Error:', error);
      return ResponseUtil.error('Failed to retrieve admin stats');
    }
  }

  @Post('watch-parties')
  async createWatchParty(@Body() dto: CreateAdminWatchPartyDto) {
    try {
      const result = await this.adminService.createWatchParty(dto);
      const isArray = Array.isArray(result);
      const message = isArray
        ? `Successfully created ${result.length} watch party event(s)`
        : 'Watch party event created successfully';
      return ResponseUtil.success(result, message);
    } catch (error) {
      console.error('Error creating watch party:', error);
      if (error instanceof Error) {
        return ResponseUtil.error(error.message);
      }
      return ResponseUtil.error('Failed to create watch party event');
    }
  }
}
