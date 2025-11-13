// voucher.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { UserVoucher } from './user-voucher.entity';
import { modelNames } from '@/common/constants/model-name.constant';

export enum VoucherType {
  PERCENT = 'PERCENT',   // giảm theo %
  FIXED = 'FIXED',       // giảm cố định (VNĐ)
  FREE = 'FREE',         // miễn phí
}

@Entity({ name: modelNames.VOUCHER })
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: VoucherType })
  type: VoucherType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number; // Ví dụ: 10 (10%) hoặc 50000 (50k)

  @Column({ type: 'timestamp' })
  start_date: Date;

  @Column({ type: 'timestamp' })
  end_date: Date;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => UserVoucher, (uv) => uv.voucher)
  user_vouchers: UserVoucher[];
}
