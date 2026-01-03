import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { User } from '../user/user.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.CHAT })
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.sending_chats)
  @IsNotEmpty({ message: 'SenderId is required' })
  sender: User;

  @ManyToOne(() => User, (user) => user.receiving_chats)
  @IsNotEmpty({ message: 'ReceiverId is required' })
  receiver: User;

  @Column({ type: 'text' })
  @IsNotEmpty()
  @IsString()
  message: string;

  /**
   * Detected language of the message (VI = Vietnamese, EN = English)
   * Stored for audit trail and future language consistency improvements
   * @example 'vi' | 'en'
   */
  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  @IsOptional()
  @IsIn(['vi', 'en'])
  detected_language?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
