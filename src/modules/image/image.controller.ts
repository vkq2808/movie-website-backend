import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponse } from '@/common';
import { multerConfig } from '@/config/multer.config';
import { JwtAuthGuard } from '../auth/guards';
import { BadRequestException, ResourcesNotFoundException } from '@/exceptions';
import { DeleteImageDto } from './image.dto';
import path, { join, normalize, resolve } from 'path';
import * as fs from 'fs'; // ✅
import sanitize from 'sanitize-filename';
import xss from 'xss';
import { lookup } from 'mime-types';
import { Response as ExpressResponse } from 'express';

@Controller('image')
export class ImageController {
  constructor(private readonly redisService: RedisService) {}

  // ===== UPLOAD IMAGE =====
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('key') key: string, // ví dụ movieId
  ): Promise<ApiResponse<{ url: string; public_id: string } | null>> {
    if (!file) throw new BadRequestException('Không có file được tải lên');

    console.log(file.filename);

    const allowedMime = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMime.includes(file.mimetype)) {
      throw new BadRequestException('Loại file không hợp lệ');
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const safeFileName = encodeURIComponent(file.filename);
    const safeBaseUrl = xss(baseUrl);
    const fileUrl = `${safeBaseUrl}/image/get/${safeFileName}`;

    // ✅ Lưu metadata ảnh vào Redis (TTL 15 phút)
    await this.redisService.set(
      `upload:${key}:${file.filename}`,
      {
        url: fileUrl,
        filePath: file.path,
        createdAt: Date.now(),
      },
      900, // TTL 15 phút
    );
    console.log('valid image');

    return {
      success: true,
      message: 'Tải lên thành công (đang chờ xác nhận)',
      data: {
        url: fileUrl,
        public_id: file.filename,
      },
    };
  }

  @Get('get/:fileName')
  async getImage(
    @Param('fileName') fileName: string,
    @Res() res: ExpressResponse,
  ) {
    if (fileName.includes('..')) {
      throw new BadRequestException('Tên file không hợp lệ');
    }
    try {
      // Thư mục chứa ảnh (bạn có thể đổi tùy cấu trúc project)
      const imagePath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'uploads',
        'images',
        fileName,
      );
      // Kiểm tra file có tồn tại không

      if (!fs.existsSync(imagePath)) {
        throw new ResourcesNotFoundException(`File ${fileName} không tồn tại`);
      }

      const contentType = lookup(imagePath) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      fs.createReadStream(imagePath).pipe(res);
    } catch {
      throw new ResourcesNotFoundException(`File ${fileName} không tồn tại`);
    }
  }

  // ===== DELETE IMAGE =====
  @Post('delete')
  @UseGuards(JwtAuthGuard)
  async deleteImage(
    @Body() { url }: DeleteImageDto,
  ): Promise<ApiResponse<null>> {
    try {
      console.log(url);
      if (!url || typeof url !== 'string') {
        console.log('No url for deleting Image');
        throw new BadRequestException('URL không hợp lệ');
      }

      // Làm sạch URL (tránh injection, xss)
      const cleanUrl = xss(url.trim());

      // Tách filename
      let fileName = cleanUrl.split('/').pop();
      if (!fileName) {
        throw new BadRequestException('URL file không hợp lệ');
      }

      // Loại bỏ ký tự độc hại trong tên file
      fileName = sanitize(fileName);

      // Không cho phép ký tự đặc biệt trong tên file (ngăn Path Traversal)
      if (
        fileName.includes('..') ||
        fileName.includes('/') ||
        fileName.includes('\\')
      ) {
        throw new BadRequestException('Đường dẫn file không an toàn');
      }

      // Chuẩn hóa và giới hạn thư mục chứa file
      const baseDir = resolve(process.cwd(), 'uploads', 'images');
      const filePath = normalize(join(baseDir, fileName));

      console.log(filePath);

      // Kiểm tra xem filePath có nằm trong baseDir không (chống path traversal)
      if (!filePath.startsWith(baseDir)) {
        throw new BadRequestException('Đường dẫn file không được ủy quyền');
      }

      // Kiểm tra tồn tại
      if (!fs.existsSync(filePath)) {
        throw new ResourcesNotFoundException(`File ${fileName} không tồn tại`);
      }

      // Xóa file thật sự
      await fs.unlink(filePath, (err) => {
        if (err) throw new BadRequestException('Không thể xóa file');
        console.log(`Delete file ${fileName} successfully`);
      });

      const keys = await this.redisService.keys('upload:*');

      for (const key in keys) {
        const value = await this.redisService.get(key);

        if (value && JSON.parse(value).url === cleanUrl) {
          console.log('deleted key:', key);
          await this.redisService.del(key);
          break;
        }
      }

      return {
        success: true,
        message: 'Ảnh đã được xóa thành công',
        data: null,
      };
    } catch (error: any) {
      console.error('Delete image error:', error);

      if (error.code === 'ENOENT') {
        return {
          success: false,
          message: 'Không tìm thấy file',
          data: null,
        };
      }

      return {
        success: false,
        message: error.message || 'Không thể xóa ảnh',
        data: null,
      };
    }
  }
}
