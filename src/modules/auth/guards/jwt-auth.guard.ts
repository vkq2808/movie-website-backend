import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  logger = new Logger(JwtAuthGuard.name);
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<import('express').Request>();

    type RequestWithCookies = import('express').Request & {
      cookies?: Partial<Record<string, string>>;
    };

    const cookiesRequest = request as RequestWithCookies;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const cookies: Partial<Record<string, string>> | undefined =
      cookiesRequest.cookies;

    // Extract JWT from 'access_token' cookie (set by AuthController)
    const access: string | undefined = cookies?.access_token;
    if (typeof access === 'string' && access.length > 0) {
      request.headers.authorization = `Bearer ${access}`;
    }

    return super.canActivate(context);
  }
}
