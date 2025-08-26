import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { User } from '@/modules/auth/user.entity';
import { Movie } from '@/modules/movie/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Movie, WatchHistory])],
  controllers: [AdminController],
})
export class AdminModule {}
