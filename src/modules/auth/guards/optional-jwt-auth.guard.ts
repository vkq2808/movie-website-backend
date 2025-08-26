import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<import('express').Request>();
    const authHeader = request.headers.authorization;

    // If no authorization header, allow the request to proceed without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.debug(
        'No authorization header found, proceeding without authentication',
      );
      return true;
    }

    // If authorization header is present, attempt JWT validation
    return super.canActivate(context);
  }

  // Match base signature while narrowing inside
  handleRequest<TUser = unknown>(
    err: unknown,
    user: unknown,
    info: unknown,
  ): TUser {
    // Log for debugging
    this.logger.debug(
      `JWT validation result: err=${Boolean(err)}, user=${Boolean(user)}, info=${
        (info as { message?: string } | undefined)?.message || 'none'
      }`,
    );

    // If there's an error or no user, return null instead of throwing
    // This allows unauthenticated requests to proceed
    if (err || !user) {
      this.logger.debug(
        'JWT validation failed, proceeding without authentication',
      );
      return null as unknown as TUser;
    }

    const typedUser = user as { sub?: string };
    this.logger.debug(`Authenticated user: ${typedUser.sub ?? 'unknown'}`);
    return user as TUser;
  }
}
