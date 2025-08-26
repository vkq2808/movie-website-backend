import { HttpException, Logger } from '@nestjs/common';

export class BaseException extends HttpException {
  private logger = new Logger('Exception');
  error: unknown;
  constructor(message: string, statusCode: number, _error: unknown = null) {
    super(message, statusCode);
    this.error = _error;
    const stack =
      _error && typeof _error === 'object' && 'stack' in _error
        ? typeof (_error as { stack?: unknown }).stack === 'string'
          ? ((_error as { stack?: unknown }).stack as string)
          : ''
        : '';
    this.logger.error(`Exception: ${message}`, stack);
  }
}
