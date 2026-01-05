import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.CONVERSATION_SESSION })
export class ConversationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language: 'vi' | 'en';

  @Column({ type: 'jsonb', default: '[]' })
  messageHistory: Array<{
    role: 'user' | 'assistant';
    text: string;
    ts: number;
  }>;

  @Column({ type: 'varchar', array: true, default: '{}' })
  suggestedMovieIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    genres?: string[];
    actors?: string[];
  };

  @Column({ type: 'varchar', nullable: true })
  lastIntent?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
