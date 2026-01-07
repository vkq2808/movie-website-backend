import { Module, MiddlewareConsumer, NestModule, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { User } from '../user/user.entity';
import { RedisModule } from '../redis/redis.module';
import { MailModule } from '../mail/mail.module';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategy//google-oauth2.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { FacebookStrategy } from './strategy/facebook-oauth2.strategy';
import { AuthAuditService } from './services/auth-audit.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { TokenBlacklistMiddleware } from './middleware/token-blacklist.middleware';
import { AuthValidationPipe } from './pipes/auth-validation.pipe';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '30d',
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    MailModule,
    forwardRef(() => WalletModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthAuditService,
    GoogleStrategy,
    JwtStrategy,
    FacebookStrategy,
    RateLimitGuard,
    AuthValidationPipe,
  ],
  exports: [AuthService, AuthAuditService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TokenBlacklistMiddleware).forRoutes('*'); // Apply to all routes to check for blacklisted tokens
  }
}
