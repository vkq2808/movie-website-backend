import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketPurchaseService } from './ticket-purchase.service';
import { TicketPurchaseController } from './ticket-purchase.controller';
import { TicketPurchase } from '@/modules/watch-party/entities/ticket-purchase.entity';
import { Ticket } from '@/modules/watch-party/entities/ticket.entity';
import { WatchParty } from '@/modules/watch-party/entities/watch-party.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([TicketPurchase, Ticket, WatchParty]),
  ],
  controllers: [TicketPurchaseController],
  providers: [TicketPurchaseService],
  exports: [TicketPurchaseService],
})
export class TicketPurchaseModule {}

