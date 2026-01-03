import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { ModerationService } from './moderation.service';
import {
  ModerationStatus,
  ModerationResolution,
} from './entities/moderation-case.entity';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('cases')
  async findAll(
    @Query('status') status?: ModerationStatus,
    @Query('assigned_moderator_id') assigned_moderator_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.moderationService.findAll({
      status,
      assigned_moderator_id,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return ResponseUtil.success(
      data,
      'Moderation cases retrieved successfully',
    );
  }

  @Get('cases/:id')
  async findById(@Param('id') id: string) {
    const case_ = await this.moderationService.findById(id);
    if (!case_) {
    return ResponseUtil.error('Moderation case not found');
    }
    return ResponseUtil.success(
      case_,
      'Moderation case retrieved successfully',
    );
  }

  @Post('cases')
  async create(
    @Body()
    body: {
      report_id?: string;
      feedback_id?: string;
      assigned_moderator_id?: string;
    },
  ) {
    const case_ = await this.moderationService.create(body);
    return ResponseUtil.success(case_, 'Moderation case created successfully');
  }

  @Put('cases/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ModerationStatus; moderator_notes?: string },
  ) {
    const case_ = await this.moderationService.updateStatus(
      id,
      body.status,
      body.moderator_notes,
    );
    return ResponseUtil.success(case_, 'Status updated successfully');
  }

  @Put('cases/:id/assign')
  async assignModerator(
    @Param('id') id: string,
    @Body() body: { moderator_id: string },
  ) {
    const case_ = await this.moderationService.assignModerator(
      id,
      body.moderator_id,
    );
    return ResponseUtil.success(case_, 'Moderator assigned successfully');
  }

  @Put('cases/:id/resolve')
  async resolve(
    @Param('id') id: string,
    @Body()
    body: {
      resolution: ModerationResolution;
      resolution_notes?: string;
    },
  ) {
    const case_ = await this.moderationService.resolve(
      id,
      body.resolution,
      body.resolution_notes,
    );
    return ResponseUtil.success(case_, 'Case resolved successfully');
  }

  @Put('cases/:id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { resolution_notes?: string },
  ) {
    const case_ = await this.moderationService.reject(
      id,
      body.resolution_notes,
    );
    return ResponseUtil.success(case_, 'Case rejected successfully');
  }
}
