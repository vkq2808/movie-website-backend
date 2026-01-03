import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Role } from './role.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: 'permission' })
@Index(['resource', 'action'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  resource: string; // e.g., 'user', 'movie', 'feedback', 'settings'

  @Column()
  action: string; // e.g., 'create', 'read', 'update', 'delete', 'ban', 'impersonate'

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

