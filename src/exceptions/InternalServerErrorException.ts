import { HttpStatus } from '@nestjs/common';
import { BaseException } from './BaseException';

export class InternalServerErrorException extends BaseException {
  constructor(message: string, error: unknown = null) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, error);
  }
}

export class SetRedisException extends InternalServerErrorException {
  constructor(error: unknown) {
    super('Set redis error', error);
  }
}

export class GetRedisException extends InternalServerErrorException {
  constructor(error: unknown) {
    super('Get redis error', error);
  }
}

export class DeleteRedisException extends InternalServerErrorException {
  constructor(error: unknown) {
    super('Delete redis error', error);
  }
}
