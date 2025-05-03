import { HttpException } from "@nestjs/common";

export class BaseException extends HttpException {
  error: any;
  constructor(message, statusCode, _error: any = null) {
    super(message, statusCode);
    this.error = _error;
  }
}