import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovieList } from './entities/movie-list.entity';
import { MovieListItem } from './entities/movie-list-item.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { User } from '@/modules/user/user.entity';
import { MovieListService } from './movie-list.service';
import { MovieListController } from './movie-list.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MovieList, MovieListItem, Movie, User])],
  providers: [MovieListService],
  controllers: [MovieListController],
  exports: [MovieListService],
})
export class MovieListModule {}
