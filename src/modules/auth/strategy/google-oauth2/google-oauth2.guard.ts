import { ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { GoogleOauth2StrategyName } from './google-oauth2.strategy';

export class GoogleOauth2Guard extends AuthGuard(GoogleOauth2StrategyName) {
  private readonly logger = new Logger(GoogleOauth2Guard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    this.logger.log('GoogleOauth2Guard canActivate called');
    return super.canActivate(context);
  }
}
