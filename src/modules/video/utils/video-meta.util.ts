import { RedisService } from '@/modules/redis/redis.service';
import { NotFoundException } from '@nestjs/common';

export async function getUploadMeta(redis: RedisService, sessionId: string) {
  const key = `upload:video:${sessionId}`;
  const meta = await redis.get<any>(key);
  if (!meta) throw new NotFoundException('Upload session not found');
  return { key, meta };
}

export async function updateUploadMeta(redis: RedisService, key: string, meta: any, data: any) {
  Object.assign(meta, data, { updated_at: Date.now() });
  await redis.set(key, meta, 60 * 60 * 24 * 7);
}
