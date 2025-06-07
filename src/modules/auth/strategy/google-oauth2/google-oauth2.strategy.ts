import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth.service';
import { enums } from '@/common';

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  'google-oauth2',
) {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });

    this.logger.log('GoogleStrategy initialized with:');
    this.logger.log(`clientID: ${configService.get<string>('GOOGLE_CLIENT_ID')?.substring(0, 5)}...`);
    this.logger.log(`callbackURL: ${configService.get<string>('GOOGLE_CALLBACK_URL')}`);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    this.logger.log('GoogleStrategy validate method called');
    this.logger.log(`Profile: ${JSON.stringify(profile)}`);

    try {
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
