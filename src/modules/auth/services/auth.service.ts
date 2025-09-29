import { Injectable, Logger } from '@nestjs/common';
import { User } from '../user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import {
  ForgetPasswordDto,
  LoginDto,
  OtpType,
  RegisterDto,
  ResendOTPDto,
  ResetPasswordDto,
  ValidateUserDto,
  VerifyDto,
  UpdateProfileDto,
  ChangePasswordDto,
  DeactivateAccountDto,
} from '../auth.dto';
import { TokenPayload } from '@/common';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { AuthAuditService } from './auth-audit.service';
import { WalletService } from '../../wallet/wallet.service';
import {
  UserNotFoundException,
  UserIsNotVerifiedException,
  InvalidCredentialsException,
  EmailAlreadyExistsException,
  OTPIncorrectException,
  OTPExpiredException,
  TokenExpiredException,
  InvalidTokenException,
  InternalServerErrorException,
} from '@/exceptions';
import {
  DeleteRedisException,
  GetRedisException,
  SetRedisException,
} from '@/exceptions/InternalServerErrorException';

// Removed unused OtpPayload interface

export interface SessionInfo {
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  loginTime: string; // ISO string
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
    private readonly auditService: AuthAuditService,
    private readonly walletService: WalletService,
  ) { }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  private async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    const b = bcrypt as unknown as {
      hash(data: string, rounds: number): Promise<string>;
    };
    return await b.hash(password, saltOrRounds);
  }

  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    const b = bcrypt as unknown as {
      compare(data: string, encrypted: string): Promise<boolean>;
    };
    return await b.compare(password, hash);
  }

  private async setOtpToRedis(
    email: string,
    otp: string,
    otpType: OtpType,
  ): Promise<void> {
    try {
      await this.redisService
        .getClient()
        .set(email + otpType, otp, 'EX', 60 * 15);
    } catch (error: unknown) {
      throw new SetRedisException(error);
    }
  }

  private async getOtpFromRedis(
    email: string,
    otpType: OtpType,
  ): Promise<string | null> {
    try {
      return await this.redisService.getClient().get(email + otpType);
    } catch (error: unknown) {
      throw new GetRedisException(error);
    }
  }
  private async deleteOtpFromRedis(
    email: string,
    otpType: OtpType,
  ): Promise<void> {
    try {
      await this.redisService.getClient().del(email + otpType);
    } catch (error: unknown) {
      throw new DeleteRedisException(error);
    }
  }

  private async sendOtpEmail(
    email: string,
    otp: string,
    otpType: OtpType,
  ): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        await this.mailService.sendOtpEmail(email, otp);
      } else {
        // In non-production, prefer logging the OTP rather than sending
        console.log(`OTP has been generated for ${email}: ${otp}`);
      }
    } catch (error: unknown) {
      // Clean up the OTP if sending fails
      await this.deleteOtpFromRedis(email, otpType);
      throw new InternalServerErrorException('Cannot send email', error);
    }
  }
  private async generateAndSendOtp(
    email: string,
    otpType: OtpType,
  ): Promise<void> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.setOtpToRedis(email, otp, otpType);
    await this.sendOtpEmail(email, otp, otpType);
  }

  private async getPayloadFromToken(token: string): Promise<TokenPayload> {
    return this.verifyToken(token);
  }
  async randomPassword(): Promise<string> {
    const length = 8;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let retVal = '';
    for (let i = 0; i < length; i++) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    retVal = retVal + 'A1';
    retVal = await this.hashPassword(retVal);

    return retVal;
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async generateToken(
    user: User,
    expiresIn: number = 60 * 60 * 24 * 7,
  ): Promise<string> {
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
    };
    return this.jwtService.signAsync(payload, { expiresIn });
  }
  async generateRefreshToken(
    user: User,
    expiresIn: number = 60 * 60 * 24 * 30,
  ): Promise<string> {
    return this.generateToken(user, expiresIn);
  }

  async toLoginResponse(user: User): Promise<{
    access_token: string;
    refresh_token: string;
    user: User;
  }> {
    return {
      access_token: await this.generateToken(user),
      refresh_token: await this.generateRefreshToken(user),
      user: user,
    };
  }
  async register({ username, email, password, birthdate }: RegisterDto) {
    return await this.userRepository.manager.transaction(
      async (transactionManager) => {
        const user = await transactionManager.findOne(User, {
          where: { email },
        });
        if (user) {
          throw new EmailAlreadyExistsException();
        }

        const newUser = transactionManager.create(User, {
          username,
          email,
          password,
          birthdate: birthdate ? new Date(birthdate) : undefined,
        });
        newUser.password = await this.hashPassword(password);

        await this.generateAndSendOtp(newUser.email, OtpType.VERIFY_EMAIL);

        // Save the user first
        await transactionManager.save(User, newUser);

        return { message: 'Register success fully, OTP sent!' };
      },
    );
  }
  async login({ email, password }: LoginDto) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new UserNotFoundException();
    }

    if (!user.is_verified) {
      const existedVerificationOtp = await this.getOtpFromRedis(
        email,
        OtpType.VERIFY_EMAIL,
      );
      if (!existedVerificationOtp) {
        await this.generateAndSendOtp(email, OtpType.VERIFY_EMAIL);
      }
      throw new UserIsNotVerifiedException();
    }

    const isPasswordCorrect = await this.comparePassword(
      password,
      user.password,
    );

    if (!isPasswordCorrect) {
      throw new InvalidCredentialsException();
    }

    const userWithRelations = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['favorite_movies', 'payments', 'wallet'],
    });

    if (!userWithRelations) {
      throw new UserNotFoundException();
    }

    return this.toLoginResponse(userWithRelations);
  }

  async validateUser(userInfo: ValidateUserDto): Promise<User> {
    // Kiểm tra xem đã tồn tại người dùng với email đó chưa
    let user = await this.userRepository.findOne({
      where: { email: userInfo.email },
    });
    if (!user) {
      // Nếu chưa tồn tại, tạo mới record
      user = this.userRepository.create(userInfo);
      const savedUser = await this.userRepository.save(user);

      try {
        // Create a wallet for the new OAuth user
        await this.walletService.createWallet(savedUser);
        console.log(`Wallet created for OAuth user: ${savedUser.id}`);
      } catch (error: unknown) {
        console.error('Error creating wallet for OAuth user:', error);
        // Continue with registration even if wallet creation fails
      }

      return savedUser;
    } else {
      // Nếu đã tồn tại, cập nhật thông tin người dùng
      user.username = userInfo.username;
      user.photo_url = userInfo.photo_url;
      user.is_verified = true; // Giả sử người dùng đã xác thực qua Google
      user.password = await this.hashPassword(userInfo.password);
      await this.userRepository.save(user);
    }
    return user;
  }

  async verify({ email, otp }: VerifyDto) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UserNotFoundException();
    }

    const existedVerificationOtp = await this.getOtpFromRedis(
      email,
      OtpType.VERIFY_EMAIL,
    );
    if (!existedVerificationOtp) {
      throw new OTPExpiredException();
    }

    if (existedVerificationOtp !== otp) {
      throw new OTPIncorrectException();
    }

    user.is_verified = true;
    const savedUser = await this.userRepository.save(user);

    // Check if user already has a wallet
    const existingWallet = await this.walletService.getWalletByUserId(
      savedUser.id,
    );

    if (!existingWallet) {
      try {
        // Create a wallet for the newly verified user
        await this.walletService.createWallet(savedUser);
        console.log(`Wallet created for verified user: ${savedUser.id}`);
      } catch (error: unknown) {
        console.error('Error creating wallet for verified user:', error);
        // Continue even if wallet creation fails
      }
    }

    return null;
  }

  async resendOTP({ email, otp_type }: ResendOTPDto) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UserNotFoundException();
    }

    await this.generateAndSendOtp(email, otp_type);

    return null;
  }

  async forgetPassword({ email }: ForgetPasswordDto) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UserNotFoundException();
    }

    await this.generateAndSendOtp(email, OtpType.RESET_PASSWORD);

    return null;
  }

  async resetPassword({ email, otp, password }: ResetPasswordDto) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UserNotFoundException();
    }

    const existedResetPasswordOtp = await this.getOtpFromRedis(
      email,
      OtpType.RESET_PASSWORD,
    );
    if (existedResetPasswordOtp !== otp) {
      throw new OTPIncorrectException();
    }

    user.password = await this.hashPassword(password);
    await this.userRepository.save(user);

    await this.deleteOtpFromRedis(email, OtpType.RESET_PASSWORD);

    return null;
  }

  async refresh_token(refresh_token: string) {
    const payload = await this.getPayloadFromToken(refresh_token);
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    // Check if refresh token is blacklisted
    const blacklistKey = `blacklist:${refresh_token}`;
    this.logger.log(`Checking blacklist for token: ${blacklistKey}`);
    try {
      const isBlacklisted = await this.redisService
        .getClient()
        .get(blacklistKey);
      if (isBlacklisted) {
        throw new InvalidTokenException();
      }
    } catch (error: unknown) {
      // Continue if Redis is unavailable, but log the error
      console.warn('Redis unavailable for blacklist check:', error);
    }

    // Generate new tokens
    const newAccessToken = await this.generateToken(user);
    const newRefreshToken = await this.generateRefreshToken(user);

    // Blacklist the old refresh token
    try {
      await this.redisService
        .getClient()
        .set(blacklistKey, 'true', 'EX', 60 * 60 * 24 * 30);
    } catch (error: unknown) {
      console.warn('Failed to blacklist old refresh token:', error);
    }

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
      },
    };
  }

  // Enhanced login method to track refresh tokens
  async enhancedLogin(
    loginData: LoginDto,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    const user = await this.getUserByEmail(loginData.email);
    if (!user || !user.is_active) {
      throw new UserNotFoundException();
    }

    if (!user.is_verified) {
      throw new UserIsNotVerifiedException();
    }

    const isPasswordCorrect = await this.comparePassword(
      loginData.password,
      user.password,
    );

    if (!isPasswordCorrect) {
      throw new InvalidCredentialsException();
    }

    const accessToken = await this.generateToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // Store session info in Redis for tracking
    const sessionInfo: SessionInfo = {
      userId: user.id,
      deviceInfo: deviceInfo || 'Unknown device',
      ipAddress: ipAddress || 'Unknown IP',
      loginTime: new Date().toISOString(),
      refreshToken: refreshToken,
    };

    const userTokensKey = `user_tokens:${user.id}`;
    try {
      const existingSessions = await this.redisService
        .getClient()
        .get(userTokensKey);
      const sessions: SessionInfo[] = existingSessions
        ? (JSON.parse(existingSessions) as SessionInfo[])
        : [];
      sessions.push(sessionInfo);

      // Keep only the last 10 sessions
      if (sessions.length > 10) {
        sessions.splice(0, sessions.length - 10);
      }

      await this.redisService
        .getClient()
        .set(userTokensKey, JSON.stringify(sessions), 'EX', 60 * 60 * 24 * 30);
    } catch (error: unknown) {
      console.warn('Failed to store session info:', error);
    }

    const userWithRelations = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['favorite_movies', 'payments', 'wallet'],
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userWithRelations,
    };
  }

  async getMe(payload: TokenPayload) {
    return this.userRepository.findOne({ where: { id: payload.sub } });
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UserNotFoundException();
    }

    // Check if username is being updated and if it's already taken
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.userRepository.findOne({
        where: { username: updateData.username },
      });
      if (existingUser) {
        throw new EmailAlreadyExistsException(); // Reuse for username conflict
      }
    }

    Object.assign(user, updateData);
    await this.userRepository.save(user);

    const userCopy: Record<string, unknown> = { ...user };
    delete (userCopy as { password?: unknown }).password;
    return userCopy as Omit<User, 'password'>;
  }

  async changePassword(userId: string, changePasswordData: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UserNotFoundException();
    }

    const isCurrentPasswordValid = await this.comparePassword(
      changePasswordData.current_password,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsException();
    }

    user.password = await this.hashPassword(changePasswordData.new_password);
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async logout(refreshToken: string) {
    // Add refresh token to blacklist in Redis
    await this.getPayloadFromToken(refreshToken);
    const blacklistKey = `blacklist:${refreshToken}`;

    try {
      await this.redisService
        .getClient()
        .set(blacklistKey, 'true', 'EX', 60 * 60 * 24 * 30); // 30 days
    } catch {
      throw new SetRedisException('Failed to blacklist token');
    }

    return { message: 'Logged out successfully' };
  }

  async deactivateAccount(
    userId: string,
    deactivateData: DeactivateAccountDto,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UserNotFoundException();
    }

    const isPasswordValid = await this.comparePassword(
      deactivateData.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    user.is_active = false;
    await this.userRepository.save(user);

    return {
      message: 'Account deactivated successfully',
      reason: deactivateData.reason,
    };
  }

  async checkEmailAvailability(email: string) {
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    return { available: !existingUser };
  }

  async checkUsernameAvailability(username: string) {
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });
    return { available: !existingUser };
  }

  async logoutAllDevices(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UserNotFoundException();
    }

    // Add logic to invalidate all refresh tokens for this user
    const userTokensKey = `user_tokens:${userId}`;
    try {
      await this.redisService.getClient().del(userTokensKey);
    } catch {
      throw new DeleteRedisException('Failed to logout from all devices');
    }

    return { message: 'Logged out from all devices successfully' };
  }

  async getActiveSessions(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UserNotFoundException();
    }

    // In a real implementation, you would fetch active sessions from Redis
    const userTokensKey = `user_tokens:${userId}`;
    try {
      const sessions = await this.redisService.getClient().get(userTokensKey);
      return {
        sessions: sessions
          ? (JSON.parse(sessions) as unknown[] as SessionInfo[])
          : [],
      };
    } catch {
      return { sessions: [] };
    }
  }

  // Improved method to verify tokens with more detailed error handling
  private async verifyToken(token: string): Promise<TokenPayload> {
    try {
      // Verify the token signature
      const payload = this.jwtService.verify<TokenPayload>(token);

      // Check if the token is blacklisted
      const blacklistKey = `blacklist:${token}`;
      try {
        const isBlacklisted = await this.redisService
          .getClient()
          .get(blacklistKey);
        if (isBlacklisted) {
          console.warn(`Token was found in blacklist: ${blacklistKey}`);
          throw new InvalidTokenException();
        }
      } catch (redisError: unknown) {
        // Log Redis errors but don't fail the verification if Redis is down
        console.warn('Redis error during token blacklist check:', redisError);
      }

      return payload;
    } catch (e: unknown) {
      if (e instanceof TokenExpiredError) {
        console.warn('Token expired');
        throw new TokenExpiredException();
      }
      if (e instanceof InvalidTokenException) {
        throw e;
      }

      // Log detailed information about the token error
      console.error('Token validation error:', e);

      // Try to decode the token to check its structure
      try {
        const decoded: unknown = this.jwtService.decode(token);
        if (!decoded) {
          console.error('Token is malformed and could not be decoded');
        } else {
          console.error(
            'Token structure seems valid but signature verification failed. Possible JWT_SECRET mismatch.',
          );
        }
      } catch (decodeError: unknown) {
        console.error('Error decoding token:', decodeError);
      }

      throw new InvalidTokenException();
    }
  }
}
