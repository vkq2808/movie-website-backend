import { Module } from '@nestjs/common';
import { MovieModule } from '../movie/movie.module';
import { UserModule } from '../user/user.module';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';

@Module({
  imports: [MovieModule, UserModule],
  controllers: [ImageController],
  providers: [ImageService],
})
export class ImageModule {}
