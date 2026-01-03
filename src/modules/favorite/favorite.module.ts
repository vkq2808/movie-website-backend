import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';
import { Favorite } from './favorite.entity';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Movie])],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
