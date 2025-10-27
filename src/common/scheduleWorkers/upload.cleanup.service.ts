import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '@/modules/redis/redis.service';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

@Injectable()
export class UploadCleanupService {
    private readonly logger = new Logger(UploadCleanupService.name);

    constructor(private readonly redisService: RedisService) { }

    // runs every hour
    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup() {
        try {
            const keys = await this.redisService.keys('upload:video:*');
            const now = Date.now();
            const thresholdMs = 1000 * 60 * 60 * 12; // 12 hours

            for (const key of keys) {
                const meta = await this.redisService.get<any>(key);
                if (!meta) continue;
                if (meta.status === 'completed') continue;

                const age = now - (meta.updated_at || meta.created_at || 0);
                if (age > thresholdMs) {
                    // cleanup chunks
                    const sessionId = meta.sessionId || key.split(':').pop();
                    const dir = path.join(process.cwd(), 'uploads', 'tmp', 'videos', sessionId);
                    if (fs.existsSync(dir)) {
                        this.logger.warn(`Cleaning up stale upload session ${sessionId}`);
                        const files = await fsPromises.readdir(dir).catch(() => []);
                        for (const f of files) {
                            await fsPromises.unlink(path.join(dir, f)).catch(() => { });
                        }
                        await fsPromises.rmdir(dir).catch(() => { });
                    }
                    // mark failed
                    meta.status = 'failed';
                    meta.updated_at = Date.now();
                    await this.redisService.set(key, meta, 60 * 60 * 24 * 7);
                }
            }
        } catch (e) {
            this.logger.error('Error during upload cleanup', e as any);
        }
    }
}
