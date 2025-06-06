import { Injectable } from '@nestjs/common';
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
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
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
    done(null, this.authService.toLoginResponse(user));
  }
}
