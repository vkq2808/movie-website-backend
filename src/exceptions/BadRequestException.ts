import { HttpStatus } from '@nestjs/common';
import { BaseException } from './BaseException';

export class BadRequestException extends BaseException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class UserIsNotVerifiedException extends BadRequestException {
  constructor() {
    super('User is not verified');
  }
}
