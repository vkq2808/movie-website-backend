import { Module } from '@nestjs/common';
import { UserSchema } from './user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategy';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategy/google-oauth2/google-oauth2.strategy';
import { modelNames } from '@/common/constants/model-name.constant';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';

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
    PassportModule.register({ defaultStrategy: ['jwt', 'google-oauth2'] }),
    MailModule,
    RedisModule
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy
  ],
  controllers: [AuthController],
  exports: [
    AuthService
  ]
})
export class AuthModule { }