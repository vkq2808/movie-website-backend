import { Module } from '@nestjs/common';
import { UserSchema } from './user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategy';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategy/google-oauth2';
import { modelNames } from '@/common/constants/model-name.constant';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';
import { FacebookStrategy } from './strategy/facebook-oauth2';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: modelNames.USER_MODEL_NAME, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PassportModule.register({ defaultStrategy: ['jwt', 'google-oauth2', 'facebook-oauth2'] }),
    MailModule,
    RedisModule
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy
  ],
  controllers: [AuthController],
  exports: [
    AuthService
  ]
})
export class AuthModule { }