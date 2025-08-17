import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  logger = new Logger(JwtAuthGuard.name);
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const cookies = request.cookies;  // <-- available here

    this.logger.debug(`Cookies: ${JSON.stringify(cookies)}`);

    // Extract JWT from 'access_token' cookie (set by AuthController)
    if (cookies?.access_token) {
      request.headers.authorization = `Bearer ${cookies.access_token}`;
    }

    return super.canActivate(context);
  }
}
