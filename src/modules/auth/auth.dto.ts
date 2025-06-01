import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength, } from 'class-validator';

export enum OtpType {
  RESET_PASSWORD = 'RESET_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
}
export class RegisterDto {

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  password: string;

  @IsDateString()
  birthdate: Date;

  @IsString()
  @IsOptional()
  role: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ValidateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;
  @IsString()
  @IsNotEmpty()
  photo_url: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsNotEmpty()
  is_verified: boolean;
}

export class ResendOTPDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsEnum(OtpType)
  @IsNotEmpty()
  otp_type: OtpType;
}

export class ForgetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  password: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class VerifyDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @Length(6)
  @IsNotEmpty()
  otp: string;
}