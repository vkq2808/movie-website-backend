import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-explicit-any */
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

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
    profile: Profile & {
      emails?: Array<{ value: string }>;
      photos?: Array<{ value: string }>;
      name?: { givenName?: string; familyName?: string };
      id: string;
    },
  ) {
    try {
      const given = (profile.name as any)?.givenName;
      const family = (profile.name as any)?.familyName;
      const username =
        [given, family].filter(Boolean).join(' ') || 'Google User';
      const password = await this.authService.randomPassword();

      const email =
        (profile.emails as any)?.[0]?.value ??
        `${profile.id as any}@google.local`;
      const photo = (profile.photos as any)?.[0]?.value ?? '';

      const user = await this.authService.validateUser({
        email,
        username,
        photo_url: photo,
        password,
        is_verified: true,
      });

      return this.authService.toLoginResponse(user);
    } catch (error: unknown) {
      this.logger.error('Error in validate method:', error);
      throw error instanceof Error ? error : new Error('Google strategy error');
    }
  }
}
