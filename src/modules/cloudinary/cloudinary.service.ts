// cloudinary.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Image, ResourceType } from '../image/image.entity';
import { Movie } from '../movie/entities/movie.entity';

@Injectable()
export class CloudinaryService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) { }

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

  async createImageRecord(imageData: {
    url: string;
    public_id: string;
    resource_type: ResourceType;
    alt?: string;
    width?: number;
    height?: number;
    bytes?: number;
  }): Promise<Image> {
    const image = this.imageRepository.create(imageData);
    return this.imageRepository.save(image);
  }

  async deleteImage(url: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(url);
      const image = await this.imageRepository.findOne({
        where: { url },
      });
      if (image) {
        await this.imageRepository.remove(image);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new BadRequestException('Failed to delete image');
    }
  }

  async deleteMultipleImages(urls: string[]): Promise<void> {
    try {
      await cloudinary.api.delete_resources(urls);
      const images = await this.imageRepository.find({
        where: { url: In(urls) },
      });
      if (images.length > 0) {
        await this.imageRepository.remove(images);
      }
    } catch (error) {
      console.error('Error deleting images:', error);
      throw new BadRequestException('Failed to delete images');
    }
  }
}
