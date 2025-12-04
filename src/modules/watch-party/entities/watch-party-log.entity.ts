import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { modelNames } from '@/common/constants/model-name.constant';
import { User } from '@/modules/user/user.entity';
import { WatchParty } from './watch-party.entity';

export enum WatchPartyEventType {
  MESSAGE = 'message',
  LIKE = 'like',
  JOIN = 'join',
  LEAVE = 'leave',
  PLAY = 'play',
  PAUSE = 'pause',
  SEEK = 'seek',
}

@Entity({ name: modelNames.WATCH_PARTY_LOG })
@Index('idx_watch_party_log_party', ['watch_party'])
@Index('idx_watch_party_log_event_time', ['event_time'])
export class WatchPartyLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WatchParty, (party) => party.logs, { onDelete: 'CASCADE' })
  watch_party: WatchParty;

  @ManyToOne(() => User, { eager: true, nullable: true })
  user?: User;

  @Column({
    type: 'enum',
    enum: WatchPartyEventType,
  })
  event_type: WatchPartyEventType;

  @Column({ type: 'jsonb', nullable: true })
  content: any;

  @Column({ type: 'timestamp' })
  real_time: Date;

  @Column({ type: 'float', default: 0 })
  event_time: number;

  @CreateDateColumn()
  created_at: Date;
}
