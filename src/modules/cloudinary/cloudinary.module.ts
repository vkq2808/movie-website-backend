// cloudinary.module.ts
import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { MongooseModule } from '@nestjs/mongoose';
import { modelNames } from '@/common/constants/model-name.constant';
import { ImageSchema } from '../image/image.schema';
import { MovieSchema } from '../movie/movie.schema';
import { MovieModule } from '../movie/movie.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: modelNames.IMAGE_MODEL_NAME, schema: ImageSchema },
      { name: modelNames.MOVIE_MODEL_NAME, schema: MovieSchema },
    ]),
    MovieModule
  ],
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule { }
