import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgetPasswordDto, LoginDto, RegisterDto, ResendOTPDto, ResetPasswordDto, VerifyDto } from './auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { Request } from 'express';
import { GoogleOauth2Guard } from './strategy';
import { TokenPayload } from '@/common';

interface RequestWithUser extends Request {
  user: TokenPayload;
}

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
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: VerifyDto) {
    return this.authService.verify(body);
  }

  @Post('resend-otp')
  @HttpCode(200)
  async resendOTP(@Body() body: ResendOTPDto) {
    return this.authService.resendOTP(body);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('forget-password')
  @HttpCode(200)
  async forgetPassword(@Body() body: ForgetPasswordDto) {
    return this.authService.forgetPassword(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Get('google-oauth2')
  @UseGuards(GoogleOauth2Guard)
  async getGoogleAuthUrl(@Req() req: Request) {
  }

  @Get('google-oauth2/callback')
  @UseGuards(AuthGuard('google-oauth2'))
  authCallback(@Req() req) {
    return req.user;
  }

  @Get('facebook-oauth2')
  @UseGuards(AuthGuard('facebook-oauth2'))
  async facebookLogin() {
  }

  @Get('facebook-oauth2/callback')
  @UseGuards(AuthGuard('facebook-oauth2'))
  async facebookLoginCallback(@Req() req) {
    return req.user;
  }

  @Get('test-token')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  testToken() {
    return { message: 'Token is valid' };
  }

  @Post('refresh-token')
  @HttpCode(200)
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  getMe(@Req() req: RequestWithUser) {
    return this.authService.getMe(req.user);
  }
}