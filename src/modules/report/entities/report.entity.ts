import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { Feedback } from '@/modules/feedback/feedback.entity';
import { modelNames } from '@/common/constants/model-name.constant';

export enum ReportType {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  FAKE_REVIEW = 'fake_review',
  OTHER = 'other',
}

export enum ReportStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity({ name: 'report' })
@Index(['status'])
@Index(['created_at'])
@Index(['reporter_id'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter: User; // User who created the report

  @Column()
  reporter_id: string;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.NEW })
  status: ReportStatus;

  // Polymorphic relations - report can be about different resources
  @ManyToOne(() => Feedback, { nullable: true })
  @JoinColumn({ name: 'feedback_id' })
  feedback?: Feedback;

  @Column({ nullable: true })
  feedback_id?: string;

  @ManyToOne(() => Movie, { nullable: true })
  @JoinColumn({ name: 'movie_id' })
  movie?: Movie;

  @Column({ nullable: true })
  movie_id?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reported_user_id' })
  reported_user?: User; // User being reported

  @Column({ nullable: true })
  reported_user_id?: string;

  @Column({ type: 'text', nullable: true })
  admin_notes?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_moderator_id' })
  assigned_moderator?: User;

  @Column({ nullable: true })
  assigned_moderator_id?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

