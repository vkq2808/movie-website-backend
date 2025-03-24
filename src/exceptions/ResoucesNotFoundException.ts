import { HttpStatus } from '@nestjs/common';
import { BaseException } from './BaseException';

class ResourcesNotFoundException extends BaseException {
  constructor(message: string) {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class UserNotFoundException extends ResourcesNotFoundException {
  constructor() {
    super('User not found');
  }
}