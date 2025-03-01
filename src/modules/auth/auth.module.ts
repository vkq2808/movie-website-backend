import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { USER_MODEL_NAME, UserSchema } from './user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: USER_MODEL_NAME, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>(process.env.JWT_SECRET || 'JWT_SECRET'), // Lấy secret từ env
        signOptions: { expiresIn: '1h' }, // Token hết hạn sau 1 giờ
      }),
    }),
  ],
  providers: [
    AuthService,
  ],
  controllers: [AuthController],
  exports: []
})
export class AuthModule { }