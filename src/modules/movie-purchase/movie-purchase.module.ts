import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviePurchaseController } from './movie-purchase.controller';
import { MoviePurchaseService } from './movie-purchase.service';
import { MoviePurchase } from './movie-purchase.entity';
import { Movie } from '../movie/entities/movie.entity';
import { User } from '../user/user.entity';
import { WalletModule } from '../wallet/wallet.module';
import { VoucherModule } from '../voucher/voucher.module';
import { Voucher } from '../voucher/entities/voucher.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MoviePurchase,
      Movie,
      User
    ]),
    WalletModule,
    VoucherModule
  ],
  controllers: [MoviePurchaseController],
  providers: [MoviePurchaseService],
  exports: [MoviePurchaseService],
})
export class MoviePurchaseModule { }
