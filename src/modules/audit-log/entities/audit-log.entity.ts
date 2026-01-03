import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { modelNames } from '@/common/constants/model-name.constant';

export enum AuditAction {
  // User actions
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_BAN = 'user.ban',
  USER_UNBAN = 'user.unban',
  USER_FORCE_LOGOUT = 'user.force_logout',
  USER_IMPERSONATE = 'user.impersonate',
  USER_RESET_PASSWORD = 'user.reset_password',

  // Movie actions
  MOVIE_CREATE = 'movie.create',
  MOVIE_UPDATE = 'movie.update',
  MOVIE_DELETE = 'movie.delete',

  // Feedback/Report actions
  FEEDBACK_CREATE = 'feedback.create',
  FEEDBACK_UPDATE = 'feedback.update',
  FEEDBACK_DELETE = 'feedback.delete',
  REPORT_CREATE = 'report.create',
  REPORT_UPDATE = 'report.update',
  MODERATION_CASE_CREATE = 'moderation_case.create',
  MODERATION_CASE_UPDATE = 'moderation_case.update',
  MODERATION_CASE_RESOLVE = 'moderation_case.resolve',

  // Role/Permission actions
  ROLE_CREATE = 'role.create',
  ROLE_UPDATE = 'role.update',
  ROLE_DELETE = 'role.delete',
  PERMISSION_CREATE = 'permission.create',
  PERMISSION_UPDATE = 'permission.update',
  ROLE_PERMISSION_ASSIGN = 'role_permission.assign',
  ROLE_PERMISSION_REVOKE = 'role_permission.revoke',

  // Settings/Feature Flag actions
  SETTINGS_UPDATE = 'settings.update',
  FEATURE_FLAG_UPDATE = 'feature_flag.update',
}

@Entity({ name: 'audit_log' })
@Index(['action'])
@Index(['actor_id'])
@Index(['created_at'])
@Index(['resource_type', 'resource_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: User; // Admin who performed the action

  @Column({ nullable: true })
  actor_id?: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column()
  resource_type: string; // e.g., 'user', 'movie', 'feedback'

  @Column({ nullable: true })
  resource_id?: string; // ID of the affected resource

  @Column({ type: 'text', nullable: true })
  description?: string; // Human-readable description

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Additional context (IP, user agent, etc.)

  @Column({ type: 'inet', nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @CreateDateColumn()
  created_at: Date;
}

