import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WatchPartyService } from './watch-party.service';
import { CreateWatchPartyDto } from './dto/create-watch-party.dto';
import { UpdateWatchPartyDto } from './dto/update-watch-party.dto';
import { WatchPartyStatus } from './entities/watch-party.entity';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '@/modules/auth/guards';
import { TicketPurchaseService } from '../ticket-purchase/ticket-purchase.service';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('watch-parties')
export class WatchPartyController {
  constructor(
    private readonly watchPartyService: WatchPartyService,
    private readonly ticketPurchaseService: TicketPurchaseService,
  ) { }

  @Post()
  create(@Body() createDto: CreateWatchPartyDto) {
    return this.watchPartyService.create(createDto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Query('status') status?: WatchPartyStatus, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.watchPartyService.findAll(status, userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.watchPartyService.findOne(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateWatchPartyDto) {
    return this.watchPartyService.update(id, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/purchase')
  async purchaseTicket(
    @Param('id') id: string,
    @Body() purchaseDto: PurchaseTicketDto,
    @Request() req: any,
  ) {
    const userId = req.user?.sub as string;

    const purchase = await this.ticketPurchaseService.purchaseTicket(id, userId, purchaseDto);
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