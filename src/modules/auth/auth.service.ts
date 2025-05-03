import { Injectable } from '@nestjs/common';
import { User } from './user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ForgetPasswordDto, LoginDto, OtpType, RegisterDto, ResendOTPDto, ResetPasswordDto, ValidateUserDto, VerifyDto } from './auth.dto';
import { TokenPayload } from '@/common';
import { modelNames } from '@/common/constants/model-name.constant';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { UserNotFoundException, UserIsNotVerifiedException, InvalidCredentialsException, EmailAlreadyExistsException, OTPIncorrectException, OTPExpiredException, TokenExpiredException, InvalidTokenException } from '@/exceptions';
import { DeleteRedisException, GetRedisException, SetRedisException } from '@/exceptions/InternalServerErrorException';

interface OtpPayload {
  otp: string;
  timeCreated: number;
  ttl: number;
}

@Injectable()
export class AuthService {

  constructor(
    @InjectModel(modelNames.USER_MODEL_NAME) private readonly user: Model<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService
  ) { }

  findById(id: string) {
    return this.user.findById(id);
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
      await this.redisService.getClient().set(email + otpType, otp, 'EX', 60 * 15);
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
      await this.redisService.getClient().del(email);
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
    this.setOtpToRedis(email, otp, otpType);
    this.sendOtpEmail(email, otp, otpType);
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
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let retVal = '';
    for (let i = 0; i < length; i++) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    retVal = retVal + 'A1';
    retVal = await this.hashPassword(retVal);

    return retVal;
  }

  private async getUserByEmail(email: string) {
    return await this.user.findOne({ email });
  }

  async generateToken(user: User, expiresIn: number = 60 * 60 * 24 * 7) {
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    };
    return this.jwtService.signAsync(payload, { expiresIn });
  }
  async generateRefreshToken(user: User, expiresIn: number = 60 * 60 * 24 * 30) {
    return this.generateToken(user, expiresIn);
  }

  async toLoginResponse(user: User) {
    return {
      accesstoken: await this.generateToken(user),
      refreshToken: await this.generateRefreshToken(user),
      user: user
    };
  }

  async register({ username, email, password, birthdate }: RegisterDto) {
    const session = await this.user.db.startSession();
    try {
      session.startTransaction();
      const user = await this.user.findOne({ email });
      if (user) {
        throw new EmailAlreadyExistsException();
      }
      const newUser = await this.user.create({ username, email, password, birthdate });
      newUser.password = await this.hashPassword(password);

      this.generateAndSendOtp(newUser.email, OtpType.VERIFY_EMAIL);

      await newUser.save();
      await session.commitTransaction();
      return { message: 'User created' };
    } finally {
      session.endSession();
    }
  }

  async login({ email, password }: LoginDto) {
    let user = await this.getUserByEmail(email);
    if (!user) {
      throw new UserNotFoundException();
    }

    if (!user.isVerified) {
      const existedVerificationOtp = await this.getOtpFromRedis(email, OtpType.VERIFY_EMAIL);
      if (!existedVerificationOtp) {
        this.generateAndSendOtp(email, OtpType.VERIFY_EMAIL);
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

    user = await this.user.findById(user.id)
      .populate({ path: 'favoriteMovies', populate: { path: 'genres' } })
      .populate({ path: 'payments' })
      .populate('wallet');

    if (!user) {
      throw new UserNotFoundException();
    }

    const retUser = user.toJSON();

    return this.toLoginResponse(retUser);
  }

  async validateUser(userInfo: ValidateUserDto): Promise<User> {
    // Kiểm tra xem đã tồn tại người dùng với email đó chưa
    let user = await this.user.findOne({ email: userInfo.email });
    if (!user) {
      // Nếu chưa tồn tại, tạo mới record
      user = new this.user(userInfo);
      await user.save();
    }
    return user;
  }

  async verify({ email, otp }: VerifyDto) {
    const user = await this.user.findOne({ email });
    if (!user) {
      throw new UserNotFoundException();
    }

    const existedVerificationOtp = await this.getOtpFromRedis(email, OtpType.VERIFY_EMAIL);
    if (!existedVerificationOtp) {
      throw new OTPExpiredException();
    }

    if (existedVerificationOtp !== otp) {
      throw new OTPIncorrectException();
    }

    user.isVerified = true;
    await user.save();
    return null;
  }

  async resendOTP({ email, otpType }: ResendOTPDto) {
    const user = await this.user.findOne({ email });
    if (!user) {
      throw new UserNotFoundException();
    }

    this.generateAndSendOtp(email, otpType);

    return null;
  }

  async forgetPassword({ email }: ForgetPasswordDto) {
    const user = await this.user.findOne({ email });

    if (!user) {
      throw new UserNotFoundException();
    }

    this.generateAndSendOtp(email, OtpType.RESET_PASSWORD);

    return null;
  }

  async resetPassword({ email, otp, password }: ResetPasswordDto) {
    const user = await this.user.findOne({ email });

    if (!user) {
      throw new UserNotFoundException();
    }

    const existedResetPasswordOtp = await this.getOtpFromRedis(email, OtpType.RESET_PASSWORD);
    if (existedResetPasswordOtp !== otp) {
      throw new OTPIncorrectException();
    }

    user.password = await this.hashPassword(password);
    await user.save();

    this.deleteOtpFromRedis(email, OtpType.RESET_PASSWORD);

    return null;
  }

  async refreshToken(refreshToken: string) {
    const payload = this.getPayloadFromToken(refreshToken);
    const user = await this.user.findById(payload.sub);

    if (!user) {
      throw new UserNotFoundException();
    }

    return await this.generateToken(user);
  }
  async getMe(payload: TokenPayload) {
    return this.user.findById(payload.sub);
  }
}