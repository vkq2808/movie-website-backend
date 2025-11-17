import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { modelNames } from '@/common/constants/model-name.constant';
import { User } from '@/modules/user/user.entity';
import { Ticket } from './ticket.entity';
import { WatchParty } from './watch-party.entity';

@Entity({ name: modelNames.TICKET_PURCHASE })
@Index('idx_ticket_purchase_user', ['user'])
@Index('idx_ticket_purchase_watch_party', ['watch_party'])
@Unique('uq_ticket_purchase_user_party', ['user', 'watch_party'])
export class TicketPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.ticket_purchases, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Ticket, (ticket) => ticket.purchases, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => WatchParty, (party) => party.ticket_purchases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'watch_party_id' })
  watch_party: WatchParty;

  @CreateDateColumn()
  created_at: Date;
}
