import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private s3: S3Client;
  private bucketName = process.env.R2_BUCKET_NAME ?? 'r2-bucketName';

  constructor() {
    this.s3 = new S3Client({
      region: 'auto', // R2 không yêu cầu region
      endpoint: process.env.R2_S3_CLIENT_ENDPOINT ?? 'r2-endpoint',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? 'r2-accessKeyId',
        secretAccessKey:
          process.env.R2_SECRET_ACCESS_KEY ?? 'r2-secretAccessKey',
      },
    });
  }

  async deleteFolder(prefix: string): Promise<void> {
    try {
      // 1️⃣ Lấy danh sách tất cả object trong thư mục
      const listResponse = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
        }),
      );

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log(`[R2] Không tìm thấy file nào trong ${prefix}`);
        return;
      }

      // 2️⃣ Chuẩn bị danh sách object cần xoá
      const objectsToDelete = listResponse.Contents.map((obj) => ({
        Key: obj.Key!,
      }));

      // 3️⃣ Xoá hàng loạt object
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: { Objects: objectsToDelete },
        }),
      );

      console.log(
        `[R2] Đã xoá ${objectsToDelete.length} files trong ${prefix}`,
      );
    } catch (error) {
      console.error('[R2] Lỗi khi xoá folder:', error);
      throw error;
    }
  }

  private getMimeType(fileName: string): string {
    if (fileName.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    if (fileName.endsWith('.ts')) return 'video/mp2t';
    return 'application/octet-stream';
  }

  async uploadFile(localPath: string, remotePath: string): Promise<string> {
    const fileStream = fs.createReadStream(localPath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: remotePath,
        Body: fileStream,
        ContentType: this.getMimeType(localPath),
      }),
    );

    return `${process.env.R2_S3_CLIENT_ENDPOINT}/${this.bucketName}/${remotePath}`;
  }

  async uploadDirectory(
    localDir: string,
    remotePrefix: string,
  ): Promise<string[]> {
    const results: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          const relativePath = path.relative(localDir, fullPath);
          const remotePath = `${remotePrefix}/${relativePath}`.replace(
            /\\/g,
            '/',
          );
          results.push(remotePath);
          this.uploadFile(fullPath, remotePath).then(() =>
            console.log(`✅ Uploaded ${remotePath}`),
          );
        }
      }
    };

    walk(localDir);
    return results;
  }
  /**
   * Tạo URL tạm thời có chữ ký cho file trong R2
   * @param key đường dẫn file (ví dụ: videos/abc123/master.m3u8)
   * @param expiresIn thời gian sống (giây)
   */
  async getSignedUrl(key: string, expiresIn = 600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn });
    return url;
  }
}
