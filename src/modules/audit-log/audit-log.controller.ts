import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { AuditLogService } from './audit-log.service';
import { AuditAction } from './entities/audit-log.entity';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(
    @Query('action') action?: AuditAction,
    @Query('resource_type') resource_type?: string,
    @Query('resource_id') resource_id?: string,
    @Query('actor_id') actor_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.auditLogService.findAll({
      action,
      resource_type,
      resource_id,
      actor_id,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return ResponseUtil.success(data, 'Audit logs retrieved successfully');
  }
}

