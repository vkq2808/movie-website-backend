import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<import('express').Request>();

    type RequestWithCookies = import('express').Request & {
      cookies?: Partial<Record<string, string>>;
    };

    const cookiesRequest = request as RequestWithCookies;

    const cookies: Partial<Record<string, string>> | undefined =
      cookiesRequest.cookies;

    const access: string | undefined = cookies?.access_token;
    if (request.headers.authorization?.startsWith('Bearer ')) {
      return super.canActivate(context);
    }
    if (typeof access === 'string' && access.length > 0) {
      request.headers.authorization = `Bearer ${access}`;
      return super.canActivate(context);
    }
    this.logger.debug('No access_token cookie found, skipping authentication');
    return true;
  }

  handleRequest(err, user, info, context) {
    const req = context.switchToHttp().getRequest();

    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }

    return user;
  }
}
