import { Module } from '@nestjs/common';
import { WatchPartyGateway } from './watch-party.gateway';
import { AuthModule } from '../auth/auth.module';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyPersistenceService } from './watch-party-persistence.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchParty } from './entities/watch-party.entity';
import { WatchPartyLog } from './entities/watch-party-log.entity';
import { Ticket } from '../ticket/ticket.entity';
import { Movie } from '../movie/entities/movie.entity';
import { TicketService } from '../ticket/ticket.service';
import { WatchPartyRoomManager } from './watch-party-room.manager';
import { UserModule } from '../user/user.module';
import { WatchPartyController } from './watch-party.controller';
import { AdminWatchPartyController } from './admin-watch-party.controller';
import { TicketPurchaseModule } from '../ticket-purchase/ticket-purchase.module';
import { TicketPurchase } from '../ticket-purchase/ticket-purchase.entity';
import { WatchPartyLiveController } from './watch-party-live.controller';
import { WatchPartyLiveService } from './watch-party-live.service';
import { WsAuthMiddleware } from '@/middlewares/ws-auth.middleware';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WatchParty,
      WatchPartyLog,
      Ticket,
      Movie,
      TicketPurchase,
    ]),
    TicketPurchaseModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '30d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    WatchPartyController,
    AdminWatchPartyController,
    WatchPartyLiveController,
  ],
  providers: [
    WatchPartyGateway,
    WsAuthMiddleware,
    WatchPartyService,
    WatchPartyPersistenceService,
    TicketService,
    WatchPartyRoomManager,
    WatchPartyLiveService,
  ],
  exports: [WatchPartyService, WatchPartyGateway],
})
export class WatchPartyModule {}
