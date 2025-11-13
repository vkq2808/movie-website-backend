import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '@/modules/watch-party/entities/ticket.entity';
import { WatchParty } from '@/modules/watch-party/entities/watch-party.entity';
import { TicketService } from './ticket.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, WatchParty])],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}

