import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from './payment.entity';
import { User } from '../user/user.entity';
import { enums } from '@/common';
import { VNPayService } from './vnpay.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';

export interface CreatePaymentData {
  user: User;
  amount: number;
  payment_method: enums.PaymentMethod;
  payment_status?: enums.PaymentStatus;
  transaction_type?:
    | 'wallet_topup'
    | 'wallet_deduction'
    | 'purchase'
    | 'refund';
  reference_id?: string; // Reference to external payment system or internal transaction
  description?: string;
  currency?: string;
  payment_url?: string;
  vnp_order_id?: string;
  ipn_url?: string;
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly vnpayService: VNPayService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

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
      currency: data.currency || 'VND',
      payment_url: data.payment_url,
      vnp_order_id: data.vnp_order_id,
      ipn_url: data.ipn_url,
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

  /**
   * Create checkout payment and return payment URL
   * @param user User entity
   * @param amount Amount to pay
   * @param currency Currency code (VND or USD)
   * @param paymentMethod Payment method
   * @param returnUrl Return URL after payment
   * @returns Payment record with payment_url
   */
  async createCheckoutPayment(
    user: User,
    amount: number,
    currency: string,
    paymentMethod: enums.PaymentMethod,
    returnUrl: string,
    ipAddr: string,
  ): Promise<Payment> {

    const payment = await this.createPayment({
      user,
      amount: amount, // store in original amount
      currency: currency,
      payment_method: paymentMethod,
      payment_status: enums.PaymentStatus.Pending,
      transaction_type: 'wallet_topup',
      description: `Payment checkout - ${amount} ${currency}`,
    });

    if (paymentMethod === enums.PaymentMethod.Vnpay) {
      const baseUrl =
        this.configService.get<string>('BASE_URL') || 'http://localhost:2808';
      const ipnUrl = `${baseUrl}/api/payment/callback/vnpay`;
      returnUrl = returnUrl ?? `${baseUrl}/payment/callback-vnpay`;
      
      const callbackUrl = `${returnUrl}/${payment.id}`;

      const paymentUrl = this.vnpayService.createPaymentUrl({
        amount: currency === 'USD' ? this.vnpayService.convertUsdToVnd(amount) : amount,
        orderId: payment.id,
        orderDescription: payment.description || 'Payment checkout',
        returnUrl: callbackUrl,
        ipnUrl: ipnUrl,
        ipAddr: ipAddr,
      });

      payment.payment_url = paymentUrl;
      payment.vnp_order_id = payment.id;
      payment.ipn_url = ipnUrl;

      return this.paymentRepository.save(payment);
    }

    return payment;
  }

  /**
   * Handle VNPay IPN callback
   * @param callbackParams VNPay callback parameters
   * @returns Payment record or null
   */
  async handleVnpayCallback(
    callbackParams: Record<string, string>,
  ): Promise<Payment | null> {
    const isValid = this.vnpayService.verifyIpnCallback(callbackParams);
    if (!isValid) {
      return null;
    }

    const orderId = this.vnpayService.getOrderId(callbackParams);
    if (!orderId) {
      return null;
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });

    if (!payment) {
      return null;
    }

    const responseCode = this.vnpayService.getResponseCode(callbackParams);
    const transactionId = this.vnpayService.getTransactionId(callbackParams);

    const wasAlreadySuccess = payment.payment_status === enums.PaymentStatus.Success;

    if (responseCode === '00') {
      payment.payment_status = enums.PaymentStatus.Success;
    } else {
      payment.payment_status = enums.PaymentStatus.Fail;
    }

    if (transactionId) {
      payment.vnp_transaction_id = transactionId;
      payment.reference_id = transactionId;
    }

    const updatedPayment = await this.paymentRepository.save(payment);

    if (
      responseCode === '00' &&
      payment.transaction_type === 'wallet_topup' &&
      !wasAlreadySuccess
    ) {
      try {
        // Convert amount from VND to USD if currency is VND
        // Wallet stores balance in USD
        let walletAmount = Number(payment.amount);
        if (payment.currency === 'VND') {
          const USD_TO_VND_RATE = 25000;
          walletAmount = walletAmount / USD_TO_VND_RATE;
        }

        // check user's wallet
        const wallet = await this.walletService.getWalletByUserId(payment.user.id);
        if (!wallet) {
          await this.walletService.createWallet(payment.user);
        }

        // Update wallet balance
        await this.walletService.addBalance(
          payment.user.id,
          walletAmount,
          payment.payment_method,
          transactionId || payment.id,
          payment.description || 'Wallet top-up via VNPay',
        );
      } catch (error) {
        console.error(
          `Failed to update wallet balance for payment ${payment.id}:`,
          error,
        );
      }
    }

    return updatedPayment;
  }
}
