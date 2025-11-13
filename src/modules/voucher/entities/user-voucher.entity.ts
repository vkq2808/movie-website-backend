import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Voucher } from './voucher.entity';
import { User } from '@/modules/user/user.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.USER_VOUCHER })
export class UserVoucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.user_vouchers)
  user: User;

  @ManyToOne(() => Voucher, (voucher) => voucher.user_vouchers)
  voucher: Voucher;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  assigned_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  used_at?: Date;
}
