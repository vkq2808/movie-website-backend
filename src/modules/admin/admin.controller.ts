import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums/role.enum';
import { ResponseUtil } from '@/common/utils/response.util';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

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
} 
