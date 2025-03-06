import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('google-oauth2')
  @UseGuards(AuthGuard('google-oauth2'))
  async authOAuth2() {
  }

  @Get('google-oauth2/callback')
  @UseGuards(AuthGuard('google-oauth2'))
  authCallback(@Req() req) {
    return req.user; // Thông tin user sau khi xác thực
  }
}