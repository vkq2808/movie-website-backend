import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TokenBlacklistMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const blacklistKey = `blacklist:${token}`;

    try {
      const isBlacklisted = await this.redisService.getClient().get(blacklistKey);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Continue if Redis is unavailable
      console.warn('Redis unavailable for token blacklist check:', error);
    }

    next();
  }
}
