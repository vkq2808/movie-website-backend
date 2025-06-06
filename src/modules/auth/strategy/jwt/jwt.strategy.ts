import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from '@/common';
import { AuthService } from '../../auth.service';
import {
  UserIsNotVerifiedException,
  UserNotFoundException,
} from '@/exceptions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'JWT_SECRET',
    });
  }

  async validate(payload: TokenPayload) {
    if (!payload.is_verified) {
      throw new UserIsNotVerifiedException();
    }

    const user = await this.authService.findById(payload.sub);
    if (!user) {
      throw new UserNotFoundException();
    }

    return {
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  }
}
