import { ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { FacebookStrategyName } from '../strategy/facebook-oauth2.strategy';

export class FacebookOauth2Guard extends AuthGuard(FacebookStrategyName) {
  private readonly logger = new Logger(FacebookOauth2Guard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    this.logger.log('FacebookOauth2Guard canActivate called');
    return super.canActivate(context);
  }
}
