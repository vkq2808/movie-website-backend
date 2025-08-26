import { ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { GoogleOauth2StrategyName } from '../strategy/google-oauth2.strategy';

export class GoogleOauth2Guard extends AuthGuard(GoogleOauth2StrategyName) {
  private readonly logger = new Logger(GoogleOauth2Guard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }
}
