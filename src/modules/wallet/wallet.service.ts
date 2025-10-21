import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BadRequestException } from '@/exceptions';
import { Wallet } from './entities/wallet.entity';
import { User } from '../user/user.entity';
import { PaymentService } from '../payment/payment.service';
import { enums } from '@/common';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly paymentService: PaymentService,
  ) { }

  /**
   * Create a new wallet for a user
   * @param user The user entity
   * @returns The created wallet
   */
  async createWallet(user: User): Promise<Wallet> {
    const wallet = this.walletRepository.create({
      user,
      balance: 0,
    });

    return this.walletRepository.save(wallet);
  }

  /**
   * Get wallet by user ID
   * @param userId The user ID
   * @returns The wallet or null if not found
   */
  async getWalletByUserId(userId: string): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  /**
   * Add balance to user's wallet
   * @param userId The user ID
   * @param amount The amount to add
   * @param paymentMethod Payment method used (optional, for external top-ups)
   * @param referenceId External payment reference (optional)
   * @param description Transaction description (optional)
   * @returns The updated wallet
   */
  async addBalance(
    userId: string,
    amount: number,
    paymentMethod?: enums.PaymentMethod,
    referenceId?: string,
    description?: string,
  ): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    wallet.balance = Number(wallet.balance) + Number(amount);
    const updatedWallet = await this.walletRepository.save(wallet);

    // Create payment record for tracking
    try {
      if (paymentMethod && referenceId) {
        // External payment (MoMo, VNPay, etc.)
        await this.paymentService.createWalletTopupPayment(
          wallet.user,
          amount,
          paymentMethod,
          referenceId,
        );
      } else {
        // Internal/manual top-up
        await this.paymentService.createPayment({
          user: wallet.user,
          amount,
          payment_method: paymentMethod || enums.PaymentMethod.Manual,
          payment_status: enums.PaymentStatus.Success,
          transaction_type: 'wallet_topup',
          reference_id: referenceId,
          description: description || 'Manual wallet top-up',
        });
      }
    } catch (error) {
      // Log error but don't fail the wallet update
      console.error('Failed to create payment record for wallet top-up:', error);
    }

    return updatedWallet;
  }

  /**
   * Deduct balance from user's wallet
   * @param userId The user ID
   * @param amount The amount to deduct
   * @param description Transaction description (optional)
   * @returns The updated wallet
   */
  async deductBalance(
    userId: string,
    amount: number,
    description?: string,
  ): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    if (Number(wallet.balance) < Number(amount)) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.balance = Number(wallet.balance) - Number(amount);
    const updatedWallet = await this.walletRepository.save(wallet);

    // Create payment record for tracking
    try {
      await this.paymentService.createWalletDeductionPayment(
        wallet.user,
        amount,
        description,
      );
    } catch (error) {
      // Log error but don't fail the wallet update
      console.error('Failed to create payment record for wallet deduction:', error);
    }

    return updatedWallet;
  }

  /**
   * Get wallet balance by user ID
   * @param userId The user ID
   * @returns The wallet balance
   */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWalletByUserId(userId);
    return wallet ? Number(wallet.balance) : 0;
  }

  /**
   * Get payment history for user's wallet transactions
   * @param userId The user ID
   * @param limit Limit results
   * @param offset Offset for pagination
   * @returns Payment history
   */
  async getPaymentHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    return this.paymentService.getUserPayments(userId, limit, offset);
  }

  /**
   * Get total payment count for user
   * @param userId The user ID
   * @returns Total payment count
   */
  async getPaymentHistoryCount(userId: string): Promise<number> {
    return this.paymentService.getUserPaymentsCount(userId);
  }

  /**
   * Get wallet transaction summary for user
   * @param userId The user ID
   * @returns Transaction summary
   */
  async getWalletSummary(userId: string) {
    const wallet = await this.getWalletByUserId(userId);
    const payments = await this.paymentService.getUserPayments(userId, 10, 0);

    const totalTopups = payments
      .filter(p => p.transaction_type === 'wallet_topup')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalDeductions = payments
      .filter(p => p.transaction_type === 'wallet_deduction')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      current_balance: wallet ? Number(wallet.balance) : 0,
      total_topups: totalTopups,
      total_deductions: totalDeductions,
      transaction_count: payments.length,
      recent_transactions: payments.slice(0, 5),
    };
  }
}
