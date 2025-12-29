import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private store = new Map<string, RateLimitStore>();

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const key = `${request.ip}-${request.path}-${request.method}`;
    const now = Date.now();

    let record = this.store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.duration * 1000,
      };
    }

    record.count++;

    if (record.count > options.points) {
      throw new HttpException(
        `Rate limit exceeded. Max ${options.points} requests per ${options.duration}s`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.store.set(key, record);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of this.store.entries()) {
        if (now > v.resetTime) {
          this.store.delete(k);
        }
      }
    }

    return next.handle();
  }
}
