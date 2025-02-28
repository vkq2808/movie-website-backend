import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('/register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('/login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}