import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from './user.schema';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './auth.dto';
import { TokenPayload } from '@/common';
import { modelNames } from '@/common/constants/model-name.constant';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import passport from 'passport';

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

  generateOtpToken = (otp: string, ttl: number): string => {
    const timeCreated = Date.now();
    const payload: OtpPayload = { otp, timeCreated, ttl };

    // Lưu ý: expiresIn nên được set tương ứng với ttl (đơn vị giây)
    const token = this.jwtService.sign(
      payload,
      {
        secret: process.env.JWT_SECRET as string,
        expiresIn: ttl / 1000
      }
    );
    return token;
  }

  private async hashPassword(password: string) {
    const saltOrRounds = 10;
    return await bcrypt.hash(password, saltOrRounds);
  }

  private async comparePassword(password: string, hash) {
    return await bcrypt.compare(password, hash);
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

  private async generateToken(user: User) {
    const age = new Date().getFullYear() - user.birthdate.getFullYear();
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      age,
      isVerified: user.isVerified
    };
    return this.jwtService.signAsync(payload);
  }

  async register({ username, email, password, birthdate }: RegisterDto) {
    const session = await this.user.db.startSession();
    try {
      session.startTransaction();
      const newUser = await this.user.create({ username, email, password, birthdate });
      newUser.password = await this.hashPassword(password);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // await this.mailService.sendOtpEmail(email, otp);
      console.log('otp', otp)
      let ok;
      await this.redisService.getClient().set(email, otp, 'EX', 60 * 15).then(
        res => {
          console.log('res', res)
          ok = res;
        }
      );
      if (ok !== 'OK') {
        throw new Error('Cannot set otp to redis');
      }
      await newUser.save();
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.log('Got error, aborted transaction', error.code);
      if (error.code === 11000) {
        throw new BadRequestException('User already exists');
      }
    } finally {
      session.endSession();
    }
  }

  async login({ email, password }: LoginDto) {
    let user = await this.getUserByEmail(email);
    if (!user) {
      throw new BadRequestException("User doesn't exist");
    }

    if (!user.isVerified) {
      const randomHash = Math.floor(100000 + Math.random() * 900000).toString();
      return { otpToken: this.generateTokenForEmail(email, randomHash) };
    }

    const isPasswordCorrect = await this.comparePassword(
      password,
      user.password,
    );
    if (!isPasswordCorrect) {
      throw new BadRequestException('Password is incorrect');
    }

    user = await this.user.findById(user.id)
      .populate({ path: 'favoriteMovies', populate: { path: 'genres' } })
      .populate({ path: 'payments' })
      .populate('wallet');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const retUser = user.toJSON();

    return { token: await this.generateToken(user), user: retUser };
  }

  async generateTokenForEmail(email: string, randomHash: string) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new BadRequestException("User doesn't exist");
    }

    const token = this.jwtService.sign(
      { email, randomHash },
      { secret: process.env.JWT_SECRET as string, expiresIn: '15m' }
    );

    return token;
  }

  async validateUser(userInfo: any): Promise<User> {
    // Kiểm tra xem đã tồn tại người dùng với email đó chưa
    let user = await this.user.findOne({ email: userInfo.email });
    if (!user) {
      // Nếu chưa tồn tại, tạo mới record
      user = new this.user(userInfo);
      await user.save();
    }
    return user;
  }

  async getEmailByToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token, { secret: process.env.JWT_SECRET as string });
      return decoded.email as string;
    } catch {
      throw new BadRequestException('Invalid token');
    }
  }

  async verify(email: string) {
    const user = await this.user.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.isVerified = true;
    await user.save();
    return { message: 'User verified' };
  }
}