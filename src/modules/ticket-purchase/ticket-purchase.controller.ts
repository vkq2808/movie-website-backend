import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { TicketPurchaseService } from './ticket-purchase.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseUtil } from '@/common/utils/response.util';
import { WatchPartyResponseDto } from '@/modules/watch-party/dto/watch-party-response.dto';

@Controller()
export class TicketPurchaseController {
  constructor(private readonly ticketPurchaseService: TicketPurchaseService) {}

  @UseGuards(JwtAuthGuard)
  @Get('users/me/purchases')
  async getMyPurchases(@Request() req: any) {
    const userId = req.user?.id;

    const purchases = await this.ticketPurchaseService.getUserPurchases(userId);

    const data = purchases.map((purchase) => ({
      purchase_id: purchase.id,
      purchased_at: purchase.created_at,
      ticket: {
        id: purchase.ticket.id,
        price: Number(purchase.ticket.price),
        description: purchase.ticket.description ?? undefined,
      },
      watch_party: WatchPartyResponseDto.fromEntity(
        purchase.watch_party,
        purchase.watch_party.ticket_purchases?.length ?? 0,
        true,
      ),
    }));

    return ResponseUtil.success(
      data,
      'Ticket purchases retrieved successfully',
    );
  }
}
