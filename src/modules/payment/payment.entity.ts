import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, Min } from 'class-validator';
import { User } from '../user/user.entity';
import { enums } from '@/common';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.PAYMENT })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.payments)
  @IsNotEmpty({ message: 'UserId is required' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNotEmpty({ message: 'Amount is required' })
  @Min(0)
  amount: number;
  @Column({ type: 'enum', enum: enums.PaymentMethod })
  @IsNotEmpty({ message: 'Payment method is required' })
  payment_method: enums.PaymentMethod;

  @Column({
    type: 'enum',
    enum: enums.PaymentStatus,
    default: enums.PaymentStatus.Pending,
  })
  payment_status: enums.PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  transaction_type: string; // wallet_topup, wallet_deduction, purchase, refund

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference_id: string; // External payment reference or internal transaction ID

  @Column({ type: 'text', nullable: true })
  description: string; // Transaction description

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
