import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = rateLimitOptions.keyGenerator
      ? rateLimitOptions.keyGenerator(request)
      : this.getDefaultKey(request);

    const redisKey = `rate_limit:${key}`;

    try {
      const current = await this.redisService.getClient().get(redisKey);
      const currentCount = current ? parseInt(current, 10) : 0;

      if (currentCount >= rateLimitOptions.limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.',
            error: 'Rate Limit Exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment counter
      const newCount = currentCount + 1;
      if (newCount === 1) {
        // Set with TTL for first request
        await this.redisService.getClient().set(redisKey, newCount, 'EX', rateLimitOptions.ttl);
      } else {
        // Just increment
        await this.redisService.getClient().incr(redisKey);
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis is down, allow the request but log the error
      console.warn('Rate limiting failed due to Redis error:', error);
      return true;
    }
  }

  private getDefaultKey(request: any): string {
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    return `${ip}:${userAgent}`;
  }
}
