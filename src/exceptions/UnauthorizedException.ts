import { HttpStatus } from "@nestjs/common";
import { BaseException } from "./BaseException";

class UnauthorizedException extends BaseException {
  constructor(message: string) {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super("Invalid credentials");
  }
}