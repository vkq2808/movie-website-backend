import {
  Injectable,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
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

    // Lấy JWT từ cookie
    const accessToken: string | undefined = cookies?.access_token;

    // Nếu có access_token, gắn vào header để Passport xử lý
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      request.headers.authorization = `Bearer ${accessToken}`;
      this.logger.debug('Found access_token cookie, attempting validation');
      return super.canActivate(context);
    }

    // Nếu không có token → cho phép truy cập không cần đăng nhập
    this.logger.debug('No access_token cookie found, skipping authentication');
    return true;
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: unknown,
    info: unknown,
  ): TUser {
    // Ghi log hỗ trợ debug
    this.logger.debug(
      `JWT validation result: err=${Boolean(err)}, user=${Boolean(
        user,
      )}, info=${(info as { message?: string } | undefined)?.message || 'none'
      }`,
    );

    // Nếu có lỗi hoặc không có user → không chặn request, trả về null
    if (err || !user) {
      this.logger.debug(
        'JWT validation failed or not present, proceeding as anonymous user',
      );
      return null as unknown as TUser;
    }

    const typedUser = user as { sub?: string };
    this.logger.debug(`Authenticated user: ${typedUser.sub ?? 'unknown'}`);
    return user as TUser;
  }
}
