import { Injectable } from '@nestjs/common';
import { User } from './user.entity';
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
} from './auth.dto';
import { TokenPayload } from '@/common';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import {
  UserNotFoundException,
  UserIsNotVerifiedException,
  InvalidCredentialsException,
  EmailAlreadyExistsException,
  OTPIncorrectException,
  OTPExpiredException,
  TokenExpiredException,
  InvalidTokenException,
} from '@/exceptions';
import {
  DeleteRedisException,
  GetRedisException,
  SetRedisException,
} from '@/exceptions/InternalServerErrorException';

interface OtpPayload {
  otp: string;
  timeCreated: number;
  ttl: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) { }

  findById(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  private async hashPassword(password: string) {
    const saltOrRounds = 10;
    return await bcrypt.hash(password, saltOrRounds);
  }

  private async comparePassword(password: string, hash) {
    return await bcrypt.compare(password, hash);
  }

  private async setOtpToRedis(email: string, otp: string, otpType: OtpType) {
    try {
      await this.redisService
        .getClient()
        .set(email + otpType, otp, 'EX', 60 * 15);
    } catch (error) {
      throw new SetRedisException(error);
    }
  }

  private async getOtpFromRedis(email: string, otpType: OtpType) {
    try {
      return await this.redisService.getClient().get(email + otpType);
    } catch (error) {
      throw new GetRedisException(error);
    }
  }
  private async deleteOtpFromRedis(email: string, otpType: OtpType) {
    try {
      await this.redisService.getClient().del(email + otpType);
    } catch (error) {
      throw new DeleteRedisException(error);
    }
  }

  private async sendOtpEmail(email: string, otp: string, otpType: OtpType) {
    // try {
    //   await this.mailService.sendOtpEmail(email, otp);
    // } catch (error) {
    // await this.deleteOtpFromRedis(email);
    //   throw new InternalServerErrorException('Cannot send email');
    // }
    console.log(`OTP has been sent to ${email}: ${otp}`);
  }
  private async generateAndSendOtp(email: string, otpType: OtpType) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.setOtpToRedis(email, otp, otpType);
    await this.sendOtpEmail(email, otp, otpType);
  }

  private getPayloadFromToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (e: unknown) {
      if (e instanceof TokenExpiredError) {
        throw new TokenExpiredException();
      }
      throw new InvalidTokenException();
    }
  }
  async randomPassword() {
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

  private async getUserByEmail(email: string) {
    return await this.userRepository.findOne({ where: { email } });
  }

  async generateToken(user: User, expiresIn: number = 60 * 60 * 24 * 7) {
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
  ) {
    return this.generateToken(user, expiresIn);
  }

  async toLoginResponse(user: User) {
    return {
      accessToken: await this.generateToken(user),
      refreshToken: await this.generateRefreshToken(user),
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
          birthdate,
        });
        newUser.password = await this.hashPassword(password);

        await this.generateAndSendOtp(newUser.email, OtpType.VERIFY_EMAIL);

        await transactionManager.save(User, newUser);
        return { message: 'User created' };
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
      relations: ['favoriteMovies', 'payments', 'wallet'],
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
    await this.userRepository.save(user);
    return null;
  }

  async resendOTP({ email, otp_type }: ResendOTPDto) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UserNotFoundException();
    }

    this.generateAndSendOtp(email, otp_type);

    return null;
  }

  async forgetPassword({ email }: ForgetPasswordDto) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UserNotFoundException();
    }

    this.generateAndSendOtp(email, OtpType.RESET_PASSWORD);

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

    this.deleteOtpFromRedis(email, OtpType.RESET_PASSWORD);

    return null;
  }

  async refreshToken(refreshToken: string) {
    const payload = this.getPayloadFromToken(refreshToken);
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return await this.generateToken(user);
  }
  async getMe(payload: TokenPayload) {
    return this.userRepository.findOne({ where: { id: payload.sub } });
  }
}
