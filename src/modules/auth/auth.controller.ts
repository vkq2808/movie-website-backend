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
  Res,
  UseGuards,
  Query,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
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
import { Request, Response } from 'express';
import { GoogleOauth2Guard, JwtAuthGuard } from './guards';
import { TokenPayload } from '@/common';
import { RateLimit } from './decorators/rate-limit.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { log } from 'console';
import { ResponseUtil } from '@/common/utils/response.util';

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
  private cookieDomain = process.env.AUTH_COOKIE_DOMAIN || undefined;
  private isProd = process.env.NODE_ENV === 'production';

  private buildCookieOptions(opts?: { httpOnly?: boolean; maxAge?: number }) {
    const base: any = {
      path: '/',
      sameSite: 'lax',
      secure: this.isProd,
      httpOnly: opts?.httpOnly ?? false,
    };
    if (typeof this.cookieDomain === 'string' && this.cookieDomain.length > 0) {
      base.domain = this.cookieDomain;
    }
    if (typeof opts?.maxAge === 'number') {
      base.maxAge = opts.maxAge;
    }
    return base;
  }

  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) { }

  @Post('register')
  @HttpCode(201)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, ttl: 300 }) // 5 registrations per 5 minutes
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: true }))
  async register(@Body() body: RegisterDto) {
    await this.authService.register(body);
    return ResponseUtil.success(null, 'Registration successful. Please check your email for verification.');
  }

  @Post('verify')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: true }))
  async verify(@Body() body: VerifyDto) {
    const result = await this.authService.verify(body);
    return ResponseUtil.success(result, 'Email verified successfully.');
  }

  @Post('resend-otp')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 3, ttl: 300 }) // 3 OTP requests per 5 minutes
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: true }))
  async resendOTP(@Body() body: ResendOTPDto) {
    const result = await this.authService.resendOTP(body);
    return ResponseUtil.success(result, 'OTP sent successfully.');
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, ttl: 300 }) // 10 login attempts per 5 minutes
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body);
    try {
      // Store access token in cookie for frontend to read
      res.cookie('access_token', result.access_token, this.buildCookieOptions({ httpOnly: false, maxAge: 24 * 60 * 60 * 1000 }));
      // Store refresh token in cookie
      res.cookie('refresh_token', result.refresh_token, this.buildCookieOptions({ httpOnly: false, maxAge: 3 * 24 * 60 * 60 * 1000 }));
    } catch (e) {
      this.logger.warn('Failed to set access_token cookie on login');
    }
    return ResponseUtil.success(result, 'Login successful.');
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
  async enhancedLogin(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown IP';
    const result = await this.authService.enhancedLogin(body, deviceInfo, ipAddress);
    try {
      res.cookie('access_token', result.access_token, this.buildCookieOptions({ httpOnly: false }));
      res.cookie('refresh_token', result.refresh_token, this.buildCookieOptions({ httpOnly: false }));
    } catch (e) {
      this.logger.warn('Failed to set access_token cookie on enhanced login');
    }
    return ResponseUtil.success(result, 'Enhanced login successful.');
  }

  @Post('forget-password')
  @HttpCode(200)
  async forgetPassword(@Body() body: ForgetPasswordDto) {
    const result = await this.authService.forgetPassword(body);
    return ResponseUtil.success(result, 'Password reset email sent successfully.');
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.authService.resetPassword(body);
    return ResponseUtil.success(result, 'Password reset successful.');
  }

  @Get('google-oauth2')
  @UseGuards(GoogleOauth2Guard)
  async getGoogleAuthUrl(@Req() req: Request) { }

  @Get('google-oauth2/callback')
  @UseGuards(GoogleOauth2Guard)
  async authCallback(@Req() req: RequestWithLoginResponse, @Res({ passthrough: true }) res: Response) {
    try {
      if (req.access_token) {
        res.cookie('access_token', req.access_token, this.buildCookieOptions({ httpOnly: false }));
      }
      if (req.refresh_token) {
        res.cookie('refresh_token', req.refresh_token, this.buildCookieOptions({ httpOnly: false }));
      }
    } catch (e) {
      this.logger.warn('Failed to set access_token cookie on Google OAuth2 callback');
    }
    return ResponseUtil.success(req.user, 'Google OAuth2 authentication successful.');
  }

  @Get('facebook-oauth2')
  @UseGuards(AuthGuard('facebook-oauth2'))
  async facebookLogin() { }

  @Get('facebook-oauth2/callback')
  @UseGuards(AuthGuard('facebook-oauth2'))
  async facebookLoginCallback(@Req() req: RequestWithLoginResponse, @Res({ passthrough: true }) res: Response) {
    try {
      if (req.access_token) {
        res.cookie('access_token', req.access_token, this.buildCookieOptions({ httpOnly: false }));
      }
      if (req.refresh_token) {
        res.cookie('refresh_token', req.refresh_token, this.buildCookieOptions({ httpOnly: false }));
      }
    } catch (e) {
      this.logger.warn('Failed to set access_token cookie on Facebook OAuth2 callback');
    }
    return ResponseUtil.success(req.user, 'Facebook OAuth2 authentication successful.');
  }

  @Get('test-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  testToken() {
    return ResponseUtil.success({ valid: true }, 'Token is valid.');
  }

  @Post('refresh-token')
  @HttpCode(200)
  async refresh_token(
    @Body() body: Partial<RefreshTokenDto>,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const provided = body?.refresh_token;
    const fromCookie = (req as any)?.cookies?.refresh_token as string | undefined;
    const refresh = provided || fromCookie;
    if (!refresh) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const result = await this.authService.refresh_token(refresh);
    try {
      res.cookie('access_token', result.access_token, this.buildCookieOptions({ httpOnly: false }));
      res.cookie('refresh_token', result.refresh_token, this.buildCookieOptions({ httpOnly: false }));
    } catch (e) {
      this.logger.warn('Failed to set access_token cookie on refresh');
    }
    return ResponseUtil.success(result, 'Token refreshed successfully.');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getMe(@Req() req: RequestWithUser) {
    const result = await this.authService.getMe(req.user);
    return ResponseUtil.success(result, 'User profile retrieved successfully.');
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() body: UpdateProfileDto,
  ) {
    const result = await this.authService.updateProfile(req.user.sub, body);
    return ResponseUtil.success(result, 'Profile updated successfully.');
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() body: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(req.user.sub, body);
    return ResponseUtil.success(result, 'Password changed successfully.');
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @Body() body: Partial<LogoutDto>,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const provided = body?.refresh_token;
    const fromCookie = (req as any)?.cookies?.refresh_token as string | undefined;
    const refresh = provided || fromCookie;
    if (!refresh) {
      return ResponseUtil.success({ message: 'Already logged out' }, 'Logged out successfully.');
    }
    const result = await this.authService.logout(refresh);
    try {
      const clearOpts: any = { path: '/' };
      if (typeof this.cookieDomain === 'string' && this.cookieDomain.length > 0) {
        clearOpts.domain = this.cookieDomain;
      }
      res.clearCookie('access_token', clearOpts);
      res.clearCookie('refresh_token', clearOpts);
    } catch (e) {
      this.logger.warn('Failed to clear access_token cookie on logout');
    }
    return ResponseUtil.success(result, 'Logged out successfully.');
  }

  @Delete('deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async deactivateAccount(
    @Req() req: RequestWithUser,
    @Body() body: DeactivateAccountDto,
  ) {
    const result = await this.authService.deactivateAccount(req.user.sub, body);
    return ResponseUtil.success(result, 'Account deactivated successfully.');
  }

  @Get('check-email')
  @HttpCode(200)
  async checkEmailAvailability(@Query() query: CheckEmailDto) {
    const result = await this.authService.checkEmailAvailability(query.email);
    return ResponseUtil.success(result, 'Email availability checked.');
  }

  @Get('check-username')
  @HttpCode(200)
  async checkUsernameAvailability(@Query() query: CheckUsernameDto) {
    const result = await this.authService.checkUsernameAvailability(query.username);
    return ResponseUtil.success(result, 'Username availability checked.');
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logoutAllDevices(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logoutAllDevices(req.user.sub);
    try {
      const clearOpts: any = { path: '/' };
      if (typeof this.cookieDomain === 'string' && this.cookieDomain.length > 0) {
        clearOpts.domain = this.cookieDomain;
      }
      res.clearCookie('access_token', clearOpts);
      res.clearCookie('refresh_token', clearOpts);
    } catch (e) {
      this.logger.warn('Failed to clear access_token cookie on logout-all');
    }
    return ResponseUtil.success(result, 'Logged out from all devices successfully.');
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getActiveSessions(@Req() req: RequestWithUser) {
    const result = await this.authService.getActiveSessions(req.user.sub);
    return ResponseUtil.success(result, 'Active sessions retrieved successfully.');
  }
}
