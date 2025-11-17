import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
