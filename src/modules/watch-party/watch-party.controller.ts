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
  ) { }

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

  /**
   * Start watch party playback
   * 
   * Host-only endpoint to initiate playback of a watch party
   * This sets the initial startTime and triggers WebSocket broadcast
   * 
   * @param id - Watch party ID
   * @param req - Request with authenticated user
   * @returns Success response with watch party details
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  async startPlayback(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new Error('User not found');
    }

    // Verify user is the host
    const watchParty = await this.watchPartyService.findOne(id, userId);
    if (watchParty.host?.id !== userId) {
      return ResponseUtil.error('Only the host can start the watch party');
    }

    // TODO: Implement logic to notify WebSocket gateway about start
    // For now, the host will emit the 'watch_party:start' event via WebSocket
    // This endpoint is optional and mainly for HTTP clients or triggers

    return ResponseUtil.success(
      {
        watch_party: watchParty,
        startTime: Date.now(),
        message: 'Playback started. Emit watch_party:start via WebSocket for clients.',
      },
      'Watch party playback initiated'
    );
  }
}
