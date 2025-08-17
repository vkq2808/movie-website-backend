import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'system_settings' })
export class SystemSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'MovieStream' })
  siteName: string;

  @Column({ type: 'text', default: 'Your ultimate movie streaming destination' })
  siteDescription: string;

  @Column({ default: 'admin@moviestream.com' })
  contactEmail: string;

  @Column({ default: false })
  maintenanceMode: boolean;

  @Column({ default: true })
  registrationEnabled: boolean;

  @Column({ default: true })
  emailNotifications: boolean;

  @Column({ default: false })
  pushNotifications: boolean;

  @Column({ default: 'en' })
  defaultLanguage: string;

  @Column({ type: 'int', default: 10 })
  maxFileSize: number; // MB

  @Column({ type: 'int', default: 30 })
  sessionTimeout: number; // minutes

  @Column({ default: true })
  enableAnalytics: boolean;

  @Column({ default: 'daily' })
  backupFrequency: string; // hourly|daily|weekly|monthly

  @Column({ type: 'int', default: 30 })
  logRetentionDays: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
