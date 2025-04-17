// cloudinary.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import toStream = require('buffer-to-stream');
import { InjectModel } from '@nestjs/mongoose';
import { modelNames } from '@/common/constants/model-name.constant';
import { Image, ResourceType } from './image.schema';
import { Model } from 'mongoose';
import { Movie } from '../movie/movie.schema';
import { api, fetchFirstImageUrl, fetchSecondImageUrl } from '@/common/utils';

@Injectable()
export class CloudinaryService {

  constructor(
    @InjectModel(modelNames.IMAGE_MODEL_NAME) private readonly image: Model<Image>,
    @InjectModel(modelNames.MOVIE_MODEL_NAME) private readonly movie: Model<Movie>
  ) {
    // this.init()
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<any> {
    // Kiểm tra kích thước file (ví dụ: giới hạn 1MB)
    if (file.size > 1 * 1024 * 1024) {
      throw new BadRequestException('Vui lòng upload file có kích thước nhỏ hơn 1MB');
    }
    // Kiểm tra định dạng file (chỉ cho phép hình ảnh)
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Định dạng file không hợp lệ. Vui lòng upload hình ảnh.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      toStream(file.buffer).pipe(uploadStream);
    });
  }

  async uploadFromUrl(imageUrl: string, folder: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder, // Tùy chọn: đặt tên thư mục trên Cloudinary
      });
      return result;
    } catch (error) {
      console.log('Lỗi khi upload hình ảnh: ' + error.message);
      return null;
    }
  }

  async processMovie(movie: Movie) {
    if (movie.posterUrl && movie.posterUrl.startsWith('http')) {
      console.log(`Movie ${movie.title} already has a poster URL!`);
      return;
    }
    console.log(`Processing movie: ${movie.title}`);

    // Tạo keywords cho poster và backdrop
    const posterKeywords = movie.title + ' poster';


    // Xử lý poster
    if (posterKeywords) {
      const img = await fetchFirstImageUrl(posterKeywords);
      if (img) {
        let res = await this.uploadFromUrl(img, 'posters');
        if (!res) {
          const newImg = await fetchSecondImageUrl(movie.title + ' poster');
          if (newImg) {
            res = await this.uploadFromUrl(newImg, 'posters');
            if (!res) return;
          }
          else
            return;
        }
        const image = this.DTO(res);
        image.alt = movie.title;
        movie.posterUrl = image.url;
        await movie.save();
        this.image.insertOne(image);
      } else {
        console.log('Poster keywords not found');
      }
    }
  }

  async init() {
    const movies = await this.movie.find();

    if (!movies || movies.length === 0) {
      console.log('No movies found to process.');
      return;
    }

    const totalImages = await this.image.countDocuments({});
    // if (totalImages < 1000) {
    //   await this.image.deleteMany({});
    //   await cloudinary.api.delete_resources_by_prefix('posters', (error, result) => {
    //     if (error) {
    //       console.log('Error deleting resources:', error);
    //     } else {
    //       console.log('Resources deleted successfully:', result);
    //     }
    //   });
    //   await cloudinary.api.delete_resources_by_prefix('backdrops', (error, result) => {
    //     if (error) {
    //       console.log('Error deleting resources:', error);
    //     } else {
    //       console.log('Resources deleted successfully:', result);
    //     }
    //   });
    // }

    for (const movie of movies) {
      await this.processMovie(movie);
    }
  }


  private DTO(data: UploadApiResponse) {
    return new this.image({
      url: data.url,
      movieId: data.movieId,
      public_id: data.public_id,
      version: data.version,
      signature: data.signature,
      width: data.width,
      height: data.height,
      format: data.format,
      resource_type: data.resource_type as ResourceType,
      tags: data.tags,
      pages: data.pages,
      bytes: data.bytes,
      type: data.type,
      etag: data.etag,
      secure_url: data.secure_url,
    });
  }
}
