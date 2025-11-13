import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchPartyController } from './watch-party.controller';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyScheduler } from './watch-party.scheduler';
import { WatchParty } from './entities/watch-party.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketPurchase } from './entities/ticket-purchase.entity';
import { WatchPartyLog } from './entities/watch-party-log.entity';
import { TicketModule } from '../ticket/ticket.module';
import { UserModule } from '../user/user.module';
import { TicketPurchaseModule } from '../ticket-purchase/ticket-purchase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WatchParty, Ticket, TicketPurchase, WatchPartyLog]),
    TicketModule,
    UserModule,
    TicketPurchaseModule,
  ],
  controllers: [WatchPartyController],
  providers: [WatchPartyService, WatchPartyGateway, WatchPartyScheduler],
  exports: [WatchPartyService],
})
export class WatchPartyModule { }