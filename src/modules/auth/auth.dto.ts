import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  Matches,
  IsStrongPassword,
} from 'class-validator';

export enum OtpType {
  RESET_PASSWORD = 'RESET_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
}
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @IsStrongPassword({
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  }, { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' })
  password: string;

  @IsDateString({}, { message: 'Please provide a valid birth date' })
  birthdate: Date;

  @IsString()
  @IsOptional()
  role: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ValidateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
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
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsEnum(OtpType)
  @IsNotEmpty()
  otp_type: OtpType;
}

export class ForgetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
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
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @Length(6)
  @IsNotEmpty()
  otp: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  current_password: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(50, { message: 'New password must not exceed 50 characters' })
  @IsStrongPassword({
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  }, { message: 'New password must contain at least one uppercase letter, one lowercase letter, and one number' })
  new_password: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username?: string;

  @IsDateString({}, { message: 'Please provide a valid birth date' })
  @IsOptional()
  birthdate?: Date;

  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Photo URL must be a valid HTTP/HTTPS URL' })
  photo_url?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class DeactivateAccountDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CheckEmailDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class CheckUsernameDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}
