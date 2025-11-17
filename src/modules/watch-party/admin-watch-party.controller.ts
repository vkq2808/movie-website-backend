import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Query,
  UseGuards,
  Delete,
  Req,
} from '@nestjs/common';
import { WatchPartyService } from './watch-party.service';
import { CreateWatchPartyDto } from './dto/create-watch-party.dto';
import { UpdateWatchPartyDto } from './dto/update-watch-party.dto';
import { JwtAuthGuard, RolesGuard } from '@/modules/auth/guards';
import { FilterWatchPartyDto } from './dto/filter-watch-party.dto';
import { Request } from 'express';
import { ResponseUtil, TokenPayload } from '@/common';
import { Role } from '@/common/enums';
import { Roles } from '../auth/decorators';
import { RequestWithUser } from '../auth/auth.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('admin/watch-parties')
export class AdminWatchPartyController {
  constructor(private readonly watchPartyService: WatchPartyService) { }

  @Post()
  async create(@Body() createDto: CreateWatchPartyDto) {
    const res = await this.watchPartyService.create(createDto);
    return ResponseUtil.success(res)
  }

  @Get()
  async findAll(@Query() filterDto: FilterWatchPartyDto) {
    const res = await this.watchPartyService.findAllAdmin(filterDto);
    return ResponseUtil.success({ watch_parties: res, total: res.length })
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const res = await this.watchPartyService.findOneAdmin(id);
    return ResponseUtil.success(res)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWatchPartyDto,
    @Req() req: RequestWithUser,
    @Query('update_type') updateType: 'single' | 'series' = 'single',
  ) {
    const res = await this.watchPartyService.update(
      id,
      updateDto,
      req.user,
      updateType,
    );
    return ResponseUtil.success(res)
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('delete_type') deleteType: 'single' | 'series' = 'single',
  ) {
    const res = await this.watchPartyService.remove(
      id,
      deleteType,
      req.user as TokenPayload,
    );
    return ResponseUtil.success(res)
  }
}
