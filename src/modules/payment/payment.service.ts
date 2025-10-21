import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from './payment.entity';
import { User } from '../user/user.entity';
import { enums } from '@/common';

export interface CreatePaymentData {
  user: User;
  amount: number;
  payment_method: enums.PaymentMethod;
  payment_status?: enums.PaymentStatus;
  transaction_type?: 'wallet_topup' | 'wallet_deduction' | 'purchase' | 'refund';
  reference_id?: string; // Reference to external payment system or internal transaction
  description?: string;
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) { }

  /**
   * Create a new payment record
   * @param data Payment data
   * @returns Created payment
   */
  async createPayment(data: CreatePaymentData): Promise<Payment> {
    const payment = this.paymentRepository.create({
      user: data.user,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_status: data.payment_status || enums.PaymentStatus.Pending,
      transaction_type: data.transaction_type,
      reference_id: data.reference_id,
      description: data.description,
    });

    return this.paymentRepository.save(payment);
  }

  /**
   * Create a wallet top-up payment record
   * @param user User entity
   * @param amount Amount to add to wallet
   * @param paymentMethod Payment method used
   * @param referenceId External payment reference (e.g., MoMo transaction ID)
   * @returns Created payment record
   */
  async createWalletTopupPayment(
    user: User,
    amount: number,
    paymentMethod: enums.PaymentMethod,
    referenceId?: string,
  ): Promise<Payment> {
    return this.createPayment({
      user,
      amount,
      payment_method: paymentMethod,
      payment_status: enums.PaymentStatus.Success, // Assume success for wallet top-up
      transaction_type: 'wallet_topup',
      reference_id: referenceId,
      description: `Wallet top-up via ${paymentMethod}`,
    });
  }

  /**
   * Create a wallet deduction payment record (for purchases)
   * @param user User entity
   * @param amount Amount deducted from wallet
   * @param description Description of the purchase
   * @returns Created payment record
   */
  async createWalletDeductionPayment(
    user: User,
    amount: number,
    description?: string,
  ): Promise<Payment> {
    return this.createPayment({
      user,
      amount,
      payment_method: enums.PaymentMethod.Bank, // Internal wallet transaction
      payment_status: enums.PaymentStatus.Success,
      transaction_type: 'wallet_deduction',
      description: description || 'Wallet deduction for purchase',
    });
  }

  /**
   * Update payment status
   * @param paymentId Payment ID
   * @param status New status
   * @returns Updated payment
   */
  async updatePaymentStatus(
    paymentId: string,
    status: enums.PaymentStatus,
  ): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return null;
    }

    payment.payment_status = status;
    return this.paymentRepository.save(payment);
  }

  /**
   * Get payments by user ID
   * @param userId User ID
   * @param limit Limit results
   * @param offset Offset for pagination
   * @returns User's payment history
   */
  async getUserPayments(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['user'],
    });
  }

  /**
   * Get payment by ID
   * @param paymentId Payment ID
   * @returns Payment or null
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });
  }

  /**
   * Get total payments count for user
   * @param userId User ID
   * @returns Total count
   */
  async getUserPaymentsCount(userId: string): Promise<number> {
    return this.paymentRepository.count({
      where: { user: { id: userId } },
    });
  }
}
