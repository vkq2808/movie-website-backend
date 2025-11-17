// cloudinary.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Movie } from '../movie/entities/movie.entity';

@Injectable()
export class CloudinaryService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ url: string; public_id: string }> {
    // Kiểm tra kích thước file (ví dụ: giới hạn 1MB)
    if (file.size > 1 * 1024 * 1024) {
      throw new BadRequestException(
        'Vui lòng upload file có kích thước nhỏ hơn 1MB',
      );
    }
    // Kiểm tra định dạng file (chỉ cho phép hình ảnh)
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        'Định dạng file không hợp lệ. Vui lòng upload hình ảnh.',
      );
    }

    return new Promise<{ url: string; public_id: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
          },
          (error, result: UploadApiResponse | undefined) => {
            if (error) {
              const err =
                error instanceof Error ? error : new Error('Upload error');
              return reject(err as Error);
            }
            if (!result) return reject(new Error('Upload failed'));
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
            });
          },
        );
        Readable.from(file.buffer).pipe(uploadStream);
      },
    );
  }

  async uploadFromUrl(
    imageUrl: string,
    folder: string,
  ): Promise<{ url: string; public_id: string }> {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder,
      });
      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error: unknown) {
      console.error(
        'Error uploading image:',
        error instanceof Error ? error.message : error,
      );
      return {
        url: imageUrl,
        public_id: imageUrl,
      };
    }
  }
}
