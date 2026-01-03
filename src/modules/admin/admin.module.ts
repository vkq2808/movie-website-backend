import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { Payment } from '@/modules/payment/payment.entity';
import { MoviePurchase } from '@/modules/movie-purchase/movie-purchase.entity';
import { GenreModule } from '../genre/genre.module';
import { WatchPartyModule } from '../watch-party/watch-party.module';
import { TicketModule } from '../ticket/ticket.module';
import { TicketPurchaseModule } from '../ticket-purchase/ticket-purchase.module';
import { RedisModule } from '@/modules/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Movie, WatchHistory, Payment, MoviePurchase]),
    GenreModule,
    WatchPartyModule,
    TicketModule,
    TicketPurchaseModule,
    RedisModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
