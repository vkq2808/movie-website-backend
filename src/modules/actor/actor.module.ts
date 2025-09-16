import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorController } from './actor.controller';
import { ActorService } from './actor.service';
import { Actor } from './actor.entity';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forFeature([Actor, Movie])],
  controllers: [ActorController],
  providers: [ActorService],
  exports: [ActorService],
})
export class ActorModule { }
