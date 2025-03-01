import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from '@/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(process.env.JWT_SECRET || 'JWT_SECRET') ||
        Buffer.from("JWT_SECRET", 'base64'),
    });
  }

  async validate(payload: TokenPayload) {
    return { userId: payload.userId, username: payload.username };
  }
}
