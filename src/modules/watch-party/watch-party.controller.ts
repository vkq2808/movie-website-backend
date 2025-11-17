import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WatchPartyService } from './watch-party.service';
import { UpdateWatchPartyDto } from './dto/update-watch-party.dto';
import { WatchPartyStatus } from './entities/watch-party.entity';
import {
  OptionalJwtAuthGuard,
  JwtAuthGuard,
  RolesGuard,
} from '@/modules/auth/guards';
import { TicketPurchaseService } from '../ticket-purchase/ticket-purchase.service';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import {
  RequestWithOptionalUser,
  RequestWithUser,
} from '../auth/auth.interface';
import { Roles } from '../auth/decorators';
import { Role } from '@/common/enums';

@Controller('watch-parties')
export class WatchPartyController {
  constructor(
    private readonly watchPartyService: WatchPartyService,
    private readonly ticketPurchaseService: TicketPurchaseService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @Query('status') status?: WatchPartyStatus,
    @Request() req?: RequestWithOptionalUser,
  ) {
    const userId = req?.user?.sub;
    return this.watchPartyService.findAll(status, userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req?: RequestWithOptionalUser) {
    const userId = req?.user?.sub;
    return this.watchPartyService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWatchPartyDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user) throw new Error('User not found');
    return this.watchPartyService.update(id, updateDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/purchase')
  async purchaseTicket(
    @Param('id') id: string,
    @Body() purchaseDto: PurchaseTicketDto,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.sub;

    const purchase = await this.ticketPurchaseService.purchaseTicket(
      id,
      userId,
      purchaseDto,
    );
    const watchParty = await this.watchPartyService.findOne(id, userId);

    return ResponseUtil.success(
      {
        purchase_id: purchase.id,
        watch_party: watchParty,
      },
      'Ticket purchased successfully',
    );
  }

  @Get(':id/logs')
  getEventLogs(@Param('id') id: string) {
    return this.watchPartyService.getEventLogs(id);
  }
}
