import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  siteName: string;

  @IsString()
  siteDescription: string;

  @IsEmail()
  contactEmail: string;

  @IsBoolean()
  maintenanceMode: boolean;

  @IsBoolean()
  registrationEnabled: boolean;

  @IsBoolean()
  emailNotifications: boolean;

  @IsBoolean()
  pushNotifications: boolean;

  @IsString()
  defaultLanguage: string;

  @IsInt()
  @Min(1)
  @Max(1024)
  maxFileSize: number;

  @IsInt()
  @Min(5)
  @Max(1440)
  sessionTimeout: number;

  @IsBoolean()
  enableAnalytics: boolean;

  @IsString()
  @IsIn(['hourly', 'daily', 'weekly', 'monthly'])
  backupFrequency: string;

  @IsInt()
  @Min(1)
  @Max(3650)
  logRetentionDays: number;
}
