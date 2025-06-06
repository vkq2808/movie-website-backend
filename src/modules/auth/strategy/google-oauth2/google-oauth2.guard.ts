import { ExecutionContext } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Observable } from 'rxjs';

export class GoogleOauth2Guard extends AuthGuard('google-oauth2') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }
}
