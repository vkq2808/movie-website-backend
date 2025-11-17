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

import { AdminWatchPartyController } from './admin-watch-party.controller';
import { WatchPartyLiveService } from './watch-party-live.service';
import { WatchPartyLiveController } from './watch-party-live.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WatchParty,
      Ticket,
      TicketPurchase,
      WatchPartyLog,
    ]),
    TicketModule,
    UserModule,
    TicketPurchaseModule,
  ],
  controllers: [
    WatchPartyController,
    AdminWatchPartyController,
    WatchPartyLiveController,
  ],
  providers: [
    WatchPartyService,
    WatchPartyGateway,
    WatchPartyScheduler,
    WatchPartyLiveService,
  ],
  exports: [WatchPartyService],
})
export class WatchPartyModule {}
