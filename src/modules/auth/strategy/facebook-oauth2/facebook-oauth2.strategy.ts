import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { AuthService } from '../../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook-oauth2') {
  constructor(private configService: ConfigService, private readonly authService: AuthService) {
    super({
      clientID: configService.get<string>('FACEBOOK_CLIENT_ID'),
      clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET'),
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL'),
      scope: ['email', 'public_profile'], // yêu cầu quyền truy cập email và public_profile
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'], // lấy thông tin cần thiết
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: Function, public_profile: any) {
    // Xử lý dữ liệu người dùng từ Facebook. Ví dụ: tìm hoặc tạo mới user trong cơ sở dữ liệu.
    const { name, emails, photos } = profile;
    const username = name.givenName + ' ' + name.familyName;
    const password = await this.authService.randomPassword();

    console.log(profile)

    const user = await this.authService.validateUser({
      email: emails[0].value,
      username,
      photoUrl: photos[0].value,
      password,
      isVerified: true,
    });
    return done(null, { user, token: await this.authService.generateToken(user) });
  }
}
