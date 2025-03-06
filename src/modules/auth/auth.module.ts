import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { USER_MODEL_NAME, UserSchema } from './user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategy/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategy/google-oauth2.strategy';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: USER_MODEL_NAME, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PassportModule.register({ defaultStrategy: ['jwt', 'google-oauth2'] }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
  ],
  controllers: [AuthController],
  exports: []
})
export class AuthModule { }