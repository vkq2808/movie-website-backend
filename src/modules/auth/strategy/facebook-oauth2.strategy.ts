import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-explicit-any */
import { Strategy, Profile } from 'passport-facebook';
import { AuthService } from '../services/auth.service';

export const FacebookStrategyName = 'facebook-oauth2';
@Injectable()
export class FacebookStrategy extends PassportStrategy(
  Strategy,
  FacebookStrategyName,
) {
  constructor(
    private configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('FACEBOOK_CLIENT_ID'),
      clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET'),
      callbackURL: `${configService.get<string>('CORS_ORIGIN')}/auth/${FacebookStrategyName}/callback`,
      scope: ['email', 'public_profile'], // yêu cầu quyền truy cập email và public_profile
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'], // lấy thông tin cần thiết
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
    const given = (profile.name as any)?.givenName;
    const family = (profile.name as any)?.familyName;
    const username =
      [given, family].filter(Boolean).join(' ') || 'Facebook User';
    const password = await this.authService.randomPassword();

    const email =
      (profile.emails as any)?.[0]?.value ??
      `${profile.id as any}@facebook.local`;
    const photo = (profile.photos as any)?.[0]?.value ?? '';

    const user = await this.authService.validateUser({
      email,
      username,
      photo_url: photo,
      password,
      is_verified: true,
    });

    return this.authService.toLoginResponse(user);
  }
}
