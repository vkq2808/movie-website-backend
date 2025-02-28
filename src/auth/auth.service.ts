import { BadRequestException, Injectable } from '@nestjs/common';
import { USER_MODEL_NAME, User } from './user.model';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './auth.dto';
import { TokenPayload } from '@/common';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(USER_MODEL_NAME) private readonly user: Model<User>,
    private readonly jwtService: JwtService,
  ) { }

  private async hashPassword(password: string) {
    const saltOrRounds = 10;
    return await bcrypt.hash(password, saltOrRounds);
  }

  private async comparePassword(password: string, hash) {
    return await bcrypt.compare(password, hash);
  }

  private async getUserByEmail(email: string) {
    return await this.user.findOne({ email });
  }

  private async generateToken(user: User) {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      age: user.age,
    };
    return this.jwtService.signAsync(payload);
  }

  async register({ email, password, age, role }: RegisterDto) {
    try {
      const newUser = await this.user.create({ email, password, age, role });
      newUser.password = await this.hashPassword(password);
      await newUser.save();
      return this.generateToken(newUser);
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async login({ email, password }: LoginDto) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new BadRequestException("User doesn't exist");
    }
    const isPasswordCorrect = await this.comparePassword(
      password,
      user.password,
    );
    if (!isPasswordCorrect) {
      throw new BadRequestException('Password is incorrect');
    }

    return this.generateToken(user);
  }
}