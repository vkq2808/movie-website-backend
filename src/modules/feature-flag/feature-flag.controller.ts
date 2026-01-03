import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagType } from './entities/feature-flag.entity';
import { ResponseUtil } from '@/common/utils/response.util';
import { TokenPayload } from '@/common/token-payload.type';

type AuthenticatedRequest = Request & { user: TokenPayload };

@Controller('admin/feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  async findAll() {
    const flags = await this.featureFlagService.findAll();
    return ResponseUtil.success(flags, 'Feature flags retrieved successfully');
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    const flag = await this.featureFlagService.get(key);
    if (!flag) {
      return ResponseUtil.error('Feature flag not found');
    }
    return ResponseUtil.success(flag, 'Feature flag retrieved successfully');
  }

  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      key: string;
      type: FeatureFlagType;
      value: string;
      description?: string;
    },
  ) {
    const flag = await this.featureFlagService.createOrUpdate(
      body.key,
      body.type,
      body.value,
      body.description,
      req.user,
    );
    return ResponseUtil.success(flag, 'Feature flag created successfully');
  }

  @Put(':key')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body()
    body: {
      type?: FeatureFlagType;
      value?: string;
      description?: string;
    },
  ) {
    const existing = await this.featureFlagService.get(key);
    if (!existing) {
      return ResponseUtil.error('Feature flag not found');
    }

    const flag = await this.featureFlagService.createOrUpdate(
      key,
      body.type || existing.type,
      body.value !== undefined ? body.value : existing.value,
      body.description !== undefined ? body.description : existing.description,
      req.user,
    );
    return ResponseUtil.success(flag, 'Feature flag updated successfully');
  }

  @Delete(':key')
  async delete(@Param('key') key: string) {
    await this.featureFlagService.delete(key);
    return ResponseUtil.success(null, 'Feature flag deleted successfully');
  }
}
