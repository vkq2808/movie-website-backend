import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { GenreModule } from '../genre/genre.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Movie, WatchHistory]),
    GenreModule
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule { }
