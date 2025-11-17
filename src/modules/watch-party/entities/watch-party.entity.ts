import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { modelNames } from '@/common/constants/model-name.constant';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { Ticket } from './ticket.entity';
import { TicketPurchase } from './ticket-purchase.entity';
import { WatchPartyLog } from './watch-party-log.entity';

export enum WatchPartyStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  FINISHED = 'finished',
}

@Entity({ name: modelNames.WATCH_PARTY })
@Index('idx_watch_party_status', ['status'])
@Index('idx_watch_party_start_time', ['start_time'])
export class WatchParty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, { eager: true })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @Column({ type: 'timestamp' })
  start_time: Date;

  @Column({ type: 'timestamp' })
  end_time: Date;

  @Column({ nullable: true })
  recurrence: string;

  @ManyToOne(() => WatchParty, { nullable: true })
  @JoinColumn({ name: 'series_id' })
  series: WatchParty;

  @Column({ name: 'series_id', nullable: true })
  series_id: string;

  @Column({ default: false })
  is_featured: boolean;

  @Column({ default: 100 })
  max_participants: number;

  @Column({
    type: 'enum',
    enum: WatchPartyStatus,
    default: WatchPartyStatus.UPCOMING,
  })
  status: WatchPartyStatus;

  @OneToOne(() => Ticket, (ticket) => ticket.watch_party, { cascade: true })
  ticket: Ticket;

  @OneToMany(() => TicketPurchase, (purchase) => purchase.watch_party)
  ticket_purchases: TicketPurchase[];

  @OneToMany(() => WatchPartyLog, (log) => log.watch_party)
  logs: WatchPartyLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
