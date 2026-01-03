import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Permission } from './permission.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: 'role' })
@Index(['name'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g., 'admin', 'moderator', 'support'

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true })
  is_active: boolean;

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permission',
    joinColumn: { name: 'role_id' },
    inverseJoinColumn: { name: 'permission_id' },
  })
  permissions: Permission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

