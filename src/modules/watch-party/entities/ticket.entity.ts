import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { modelNames } from '@/common/constants/model-name.constant';
import { WatchParty } from './watch-party.entity';
import { TicketPurchase } from './ticket-purchase.entity';

@Entity({ name: modelNames.TICKET })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => WatchParty, (party) => party.ticket, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'watch_party_id' })
  watch_party: WatchParty;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  price: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => TicketPurchase, (purchase) => purchase.ticket)
  purchases: TicketPurchase[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}