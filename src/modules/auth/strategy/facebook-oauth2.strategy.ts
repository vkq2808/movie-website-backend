import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
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
    profile: any,
    done: Function,
  ) {
    // Xử lý dữ liệu người dùng từ Facebook. Ví dụ: tìm hoặc tạo mới user trong cơ sở dữ liệu.
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
    return done(null, await this.authService.toLoginResponse(user));
  }
}
