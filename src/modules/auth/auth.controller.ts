import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthService } from './services/auth.service';
import {
  ForgetPasswordDto,
  LoginDto,
  RegisterDto,
  ResendOTPDto,
  ResetPasswordDto,
  VerifyDto,
  ChangePasswordDto,
  UpdateProfileDto,
  RefreshTokenDto,
  LogoutDto,
  DeactivateAccountDto,
  CheckEmailDto,
  CheckUsernameDto,
} from './auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { Request } from 'express';
import { GoogleOauth2Guard, JwtAuthGuard } from './guards';
import { TokenPayload } from '@/common';
import { RateLimit } from './decorators/rate-limit.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { log } from 'console';

interface RequestWithUser extends Request {
  user: TokenPayload;
}

interface RequestWithLoginResponse extends Request {
  access_token: string;
  refresh_token: string;
  user: TokenPayload;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, ttl: 300 }) // 5 registrations per 5 minutes
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
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 3, ttl: 300 }) // 3 OTP requests per 5 minutes
  async resendOTP(@Body() body: ResendOTPDto) {
    return this.authService.resendOTP(body);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, ttl: 300 }) // 10 login attempts per 5 minutes
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  /**
   * Thu thập thông tin thiết bị và IP
   * Lưu trữ thông tin phiên trong Redis
   * Theo dõi và giới hạn số lượng phiên đăng nhập (10 phiên)
   * Tạo cơ chế quản lý phiên đăng nhập cho "Đăng xuất khỏi tất cả thiết bị"
   * @param body LoginDto containing email and password
   * @param req Request object to extract device and IP information
   */
  @Post('login-enhanced')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, ttl: 300 }) // 10 login attempts per 5 minutes
  async enhancedLogin(@Body() body: LoginDto, @Req() req: Request) {
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown IP';
    return this.authService.enhancedLogin(body, deviceInfo, ipAddress);
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
  async getGoogleAuthUrl(@Req() req: Request) {}

  @Get('google-oauth2/callback')
  @UseGuards(GoogleOauth2Guard)
  async authCallback(@Req() req: RequestWithLoginResponse) {
    return req.user;
  }

  @Get('facebook-oauth2')
  @UseGuards(AuthGuard('facebook-oauth2'))
  async facebookLogin() {}

  @Get('facebook-oauth2/callback')
  @UseGuards(AuthGuard('facebook-oauth2'))
  async facebookLoginCallback(@Req() req: RequestWithLoginResponse) {
    return req.user;
  }

  @Get('test-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  testToken() {
    return { message: 'Token is valid' };
  }

  @Post('refresh-token')
  @HttpCode(200)
  async refresh_token(@Body() body: RefreshTokenDto) {
    return this.authService.refresh_token(body.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  getMe(@Req() req: RequestWithUser) {
    return this.authService.getMe(req.user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.sub, body);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, body);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(@Body() body: LogoutDto) {
    return this.authService.logout(body.refresh_token);
  }

  @Delete('deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async deactivateAccount(
    @Req() req: RequestWithUser,
    @Body() body: DeactivateAccountDto,
  ) {
    return this.authService.deactivateAccount(req.user.sub, body);
  }

  @Get('check-email')
  @HttpCode(200)
  async checkEmailAvailability(@Query() query: CheckEmailDto) {
    return this.authService.checkEmailAvailability(query.email);
  }

  @Get('check-username')
  @HttpCode(200)
  async checkUsernameAvailability(@Query() query: CheckUsernameDto) {
    return this.authService.checkUsernameAvailability(query.username);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logoutAllDevices(@Req() req: RequestWithUser) {
    return this.authService.logoutAllDevices(req.user.sub);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getActiveSessions(@Req() req: RequestWithUser) {
    return this.authService.getActiveSessions(req.user.sub);
  }
}
