import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth.service';
import { enums } from '@/common';

export const GoogleOauth2StrategyName = 'google-oauth2';
@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  GoogleOauth2StrategyName,
) {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get<string>('CORS_ORIGIN')}/auth/${GoogleOauth2StrategyName}/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    access_token: string,
    refresh_token: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    this.logger.log('GoogleStrategy validate method called');
    this.logger.log(`Profile: ${JSON.stringify(profile)}`);

    try {
      console.log('profile:', profile);
      const { name, emails, photos } = profile;
      const username = name.givenName + ' ' + name.familyName;
      const password = await this.authService.randomPassword();

      const user = await this.authService.validateUser({
        email: emails[0].value,
        username,
        photo_url: photos[0].value,
        password,
        is_verified: true,
      });

      const result = this.authService.toLoginResponse(user);
      this.logger.log('User authenticated successfully');
      done(null, result);
    } catch (error) {
      this.logger.error('Error in validate method:', error);
      done(error, null);
    }
  }
}
