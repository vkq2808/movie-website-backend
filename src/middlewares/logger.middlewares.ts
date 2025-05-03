import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${this.maximizeString(req.originalUrl)}`);
    next();
  }

  private maximizeString(str: string, maxLength: number = 40): string {
    return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
  }
}
