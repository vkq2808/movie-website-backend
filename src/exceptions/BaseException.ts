import { HttpException, Logger } from '@nestjs/common';

export class BaseException extends HttpException {
  private logger = new Logger('Exception');
  error: any;
  constructor(message, statusCode, _error: any = null) {
    super(message, statusCode);
    this.error = _error;
    this.logger.error(`Exception: ${message}`, _error ? _error.stack : '');
  }
}
