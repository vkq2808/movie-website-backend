import { HttpStatus } from "@nestjs/common";
import { BaseException } from "./BaseException";

class ConflictException extends BaseException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

export class EmailAlreadyExistsException extends ConflictException {
  constructor() {
    super("Email already exists");
  }
}

export class OTPExpiredException extends ConflictException {
  constructor() {
    super("OTP expired");
  }
}

export class OTPIncorrectException extends ConflictException {
  constructor() {
    super("OTP incorrect");
  }
}