import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { GenreModule } from '../genre/genre.module';
import { WatchPartyModule } from '../watch-party/watch-party.module';
import { TicketModule } from '../ticket/ticket.module';
import { TicketPurchaseModule } from '../ticket-purchase/ticket-purchase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Movie, WatchHistory]),
    GenreModule,
    WatchPartyModule,
    TicketModule,
    TicketPurchaseModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule { }
