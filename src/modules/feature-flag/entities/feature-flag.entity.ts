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
import { modelNames } from '@/common/constants/model-name.constant';

export enum FeatureFlagType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
  JSON = 'json',
}

@Entity({ name: 'feature_flag' })
@Index(['key'], { unique: true })
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // e.g., 'watch_party_enabled', 'maintenance_mode'

  @Column({ type: 'enum', enum: FeatureFlagType })
  type: FeatureFlagType;

  @Column({ type: 'text' })
  value: string; // Stored as string, parsed based on type

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  updated_by?: User;

  @Column({ nullable: true })
  updated_by_id?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

