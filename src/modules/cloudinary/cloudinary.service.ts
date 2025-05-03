// cloudinary.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import toStream = require('buffer-to-stream');
import { InjectModel } from '@nestjs/mongoose';
import { modelNames } from '@/common/constants/model-name.constant';
import { Image, ResourceType } from '../image/image.schema';
import { Model, ObjectId } from 'mongoose';
import { Movie } from '../movie/movie.schema';

@Injectable()
export class CloudinaryService {

  constructor(
    @InjectModel(modelNames.IMAGE_MODEL_NAME) private readonly image: Model<Image>,
    @InjectModel(modelNames.MOVIE_MODEL_NAME) private readonly movie: Model<Movie>
  ) {
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
      return {
        url: imageUrl,
        public_id: imageUrl
      };
    }
  }
}
