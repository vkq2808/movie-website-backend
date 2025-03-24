import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { Request } from 'express';
import { GoogleOauth2Guard } from './strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService
  ) { }

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterDto) {
    await this.authService.register(body);

    // Lưu mã otp vào redis
    const randomHash = Math.floor(100000 + Math.random() * 900000).toString();

    // tạo token để tránh lộ email
    return { otpToken: await this.authService.generateTokenForEmail(body.email, randomHash) };
  }

  @Get('get-email/:token')
  @HttpCode(200)
  async getEmail(@Req() req: Request) {
    return { email: await this.authService.getEmailByToken(req.params.token) };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body) {
    const otp = await this.redisService.getClient().get(body.email);

    if (otp === body.otp) {
      return this.authService.verify(body.email);
    }

    throw new Error('Invalid OTP');
  }

  @Post('resend-otp')
  @HttpCode(200)
  async resendOTP(@Body() body) {
    const otpExisted = await this.redisService.getClient().get(body.email);
    if (otpExisted) {
      await this.mailService.sendOtpEmail(body.email, otpExisted);
      return { message: 'OTP đã được gửi lại.' };
    }
    // Gửi otp mới

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.mailService.sendOtpEmail(body.email, otp);

    return { message: 'OTP đã được gửi lại.' };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('google-oauth2')
  @UseGuards(GoogleOauth2Guard)
  async getGoogleAuthUrl(@Req() req: Request) {
    return { url: req.get('location') }; // Lấy URL Google OAuth2
  }

  @Get('google-oauth2/callback')
  @UseGuards(AuthGuard('google-oauth2'))
  authCallback(@Req() req) {
    return req.user; // Thông tin user sau khi xác thực
  }

  @Get('test-token')
  @UseGuards(AuthGuard('jwt'))
  testToken() {
    return { message: 'Token is valid' };
  }
}