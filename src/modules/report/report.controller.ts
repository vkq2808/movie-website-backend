import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { ReportService } from './report.service';
import { ReportStatus, ReportType } from './entities/report.entity';
import { ResponseUtil } from '@/common/utils/response.util';
import { TokenPayload } from '@/common/token-payload.type';

type AuthenticatedRequest = Request & { user: TokenPayload };

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      type: ReportType;
      reason: string;
      feedback_id?: string;
      movie_id?: string;
      reported_user_id?: string;
    },
  ) {
    const report = await this.reportService.create({
      reporter_id: req.user.sub,
      ...body,
    });
    return ResponseUtil.success(report, 'Report created successfully');
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async findAll(
    @Query('status') status?: ReportStatus,
    @Query('type') type?: ReportType,
    @Query('reporter_id') reporter_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.reportService.findAll({
      status,
      type,
      reporter_id,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return ResponseUtil.success(data, 'Reports retrieved successfully');
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async findById(@Param('id') id: string) {
    const report = await this.reportService.findById(id);
    if (!report) {
      return ResponseUtil.error('Report not found');
    }
    return ResponseUtil.success(report, 'Report retrieved successfully');
  }

  @Put('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus; admin_notes?: string },
  ) {
    const report = await this.reportService.updateStatus(
      id,
      body.status,
      body.admin_notes,
    );
    return ResponseUtil.success(report, 'Report status updated successfully');
  }

  @Put('admin/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async assignModerator(
    @Param('id') id: string,
    @Body() body: { moderator_id: string },
  ) {
    const report = await this.reportService.assignModerator(
      id,
      body.moderator_id,
    );
    return ResponseUtil.success(report, 'Moderator assigned successfully');
  }
}
