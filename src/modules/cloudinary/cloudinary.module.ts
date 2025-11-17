// cloudinary.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryService } from './cloudinary.service';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forFeature([Movie])],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
