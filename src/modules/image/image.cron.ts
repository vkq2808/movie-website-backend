import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import { RedisService } from '../redis/redis.service';
import { MovieService } from '../movie/services/movie.service';
import { UserService } from '../user/user.service';
import { PersonService } from '../person/person.service';

@Injectable()
export class ImageCleanupJob {
  private readonly logger = new Logger('[CleanUpImage]');

  constructor(
    private readonly redisService: RedisService,
    private readonly movieService: MovieService,
    private readonly userService: UserService,
    private readonly personService: PersonService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanUnlinkedImages() {
    const keys = await this.redisService.keys('upload:*');
    this.logger.log(`Checking ${keys.length} temporary uploads...`);

    for (const key of keys) {
      const value = await this.redisService.get(key);
      const ttl = await this.redisService.ttl(key);
      if (ttl === -1) continue;
      if (ttl > 450) continue;
      if (!value) continue;

      const { url, filePath } = value;

      const linked = await this.isImageLinked(url, key);

      if (!linked) {
        try {
          await fs.unlink(filePath);
          await this.redisService.del(key);
          this.logger.log(`Deleted orphaned image: ${url}`);
        } catch (err) {
          this.logger.error(`Failed to delete ${url}`, err);
        }
      }
    }
  }

  async isImageLinked(url: string, key: string): Promise<boolean> {
    try {
      // key format: upload:<category>-<entityId>:<fileName>
      // ví dụ: upload:movie-5aced63b-9c4d-4b32-a5d2-173bc45bf334:poster.png
      const [_, categoryAndEntityId] = key.split(':');
      if (!categoryAndEntityId) return false;

      const [category, ...entityIdFragments] = categoryAndEntityId.split('-');
      const entityId = entityIdFragments.join('');
      if (!category || !entityId) return false;

      switch (category) {
        case 'movie': {
          const movie = await this.movieService.getMovieById(entityId);
          if (!movie) return false;

          // Kiểm tra xem ảnh có được dùng trong movie không
          const imageFields = [...movie.posters, ...movie.backdrops];
          return imageFields.some((img) => img?.url === url);
        }

        case 'user': {
          const user = await this.userService.findById(entityId);
          if (!user) return false;

          return user.photo_url === url;
        }

        case 'person': {
          const person = await this.personService.getById(entityId);
          if (!person) return false;

          return person.profile_image?.url === url;
        }

        default:
          return false;
      }
    } catch (error) {
      this.logger.error('[isImageLinked] Error:', error);
      return false;
    }
  }
}
