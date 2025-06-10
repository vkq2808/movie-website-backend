// cloudinary.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryService } from './cloudinary.service';
import { Image } from '../image/image.entity';
import { Movie } from '../movie/movie.entity';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forFeature([Image, Movie])],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
