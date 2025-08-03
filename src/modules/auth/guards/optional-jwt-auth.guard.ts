import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // If no authorization header, allow the request to proceed without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.debug('No authorization header found, proceeding without authentication');
      return true;
    }

    // If authorization header is present, attempt JWT validation
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Log for debugging
    this.logger.debug(`JWT validation result: err=${!!err}, user=${!!user}, info=${info?.message || 'none'}`);

    // If there's an error or no user, return null instead of throwing
    // This allows unauthenticated requests to proceed
    if (err || !user) {
      this.logger.debug('JWT validation failed, proceeding without authentication');
      return null;
    }

    this.logger.debug(`Authenticated user: ${user.sub}`);
    return user;
  }
}
