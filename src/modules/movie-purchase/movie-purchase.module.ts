import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviePurchaseController } from './movie-purchase.controller';
import { MoviePurchaseService } from './movie-purchase.service';
import { MoviePurchase } from './movie-purchase.entity';
import { Movie } from '../movie/movie.entity';
import { User } from '../auth/user.entity';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MoviePurchase, Movie, User]),
    WalletModule,
  ],
  controllers: [MoviePurchaseController],
  providers: [MoviePurchaseService],
  exports: [MoviePurchaseService],
})
export class MoviePurchaseModule {}
