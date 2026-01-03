import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Report } from '@/modules/report/entities/report.entity';
import { Feedback } from '@/modules/feedback/feedback.entity';
import { modelNames } from '@/common/constants/model-name.constant';

export enum ModerationStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum ModerationResolution {
  CONTENT_REMOVED = 'content_removed',
  USER_WARNED = 'user_warned',
  USER_BANNED = 'user_banned',
  NO_ACTION = 'no_action',
  FALSE_REPORT = 'false_report',
}

@Entity({ name: 'moderation_case' })
@Index(['status'])
@Index(['created_at'])
@Index(['assigned_moderator_id'])
export class ModerationCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ModerationStatus, default: ModerationStatus.NEW })
  status: ModerationStatus;

  @Column({ type: 'enum', enum: ModerationResolution, nullable: true })
  resolution?: ModerationResolution;

  // Can be created from a report or directly
  @ManyToOne(() => Report, { nullable: true })
  @JoinColumn({ name: 'report_id' })
  report?: Report;

  @Column({ nullable: true })
  report_id?: string;

  // Or from feedback directly
  @ManyToOne(() => Feedback, { nullable: true })
  @JoinColumn({ name: 'feedback_id' })
  feedback?: Feedback;

  @Column({ nullable: true })
  feedback_id?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_moderator_id' })
  assigned_moderator?: User;

  @Column({ nullable: true })
  assigned_moderator_id?: string;

  @Column({ type: 'text', nullable: true })
  moderator_notes?: string;

  @Column({ type: 'text', nullable: true })
  resolution_notes?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at?: Date;
}

