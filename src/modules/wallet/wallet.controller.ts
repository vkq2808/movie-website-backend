import {
  Controller,
  UseGuards,
  Get,
  Post,
  Body,
  Req,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { Request } from 'express';
import { TokenPayload, enums } from '@/common';
import { AddBalanceDto, DeductBalanceDto } from './dto';
import { ResponseUtil } from '@/common/utils/response.util';

interface RequestWithUser extends Request {
  user: TokenPayload;
}

/**
 * Wallet Controller with Payment Tracking
 *
 * This controller provides wallet management with automatic payment tracking.
 * All wallet operations (add/deduct balance) are recorded in the payment system
 * for audit trails and data analysis, even in sandbox mode.
 *
 * Available endpoints:
 * - GET /wallet/my-wallet - Get current wallet info
 * - GET /wallet/balance - Get current balance
 * - POST /wallet/add-balance - Add balance with payment tracking
 * - POST /wallet/deduct-balance - Deduct balance with payment tracking
 * - GET /wallet/payment-history - Get transaction history
 * - GET /wallet/summary - Get wallet summary with statistics
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Get the current user's wallet
   * @param req Request with user info
   * @returns The user's wallet
   */
  @Get('my-wallet')
  async getMyWallet(@Req() req: RequestWithUser) {
    const userId = req.user.sub;
    const wallet = await this.walletService.getWalletByUserId(userId);

    if (!wallet) {
      throw new HttpException('Wallet not found', HttpStatus.NOT_FOUND);
    }

    return ResponseUtil.success(
      {
        id: wallet.id,
        balance: wallet.balance,
        created_at: wallet.created_at,
        updated_at: wallet.updated_at,
      },
      'Wallet retrieved successfully.',
    );
  }

  /**
   * Get the current user's wallet balance
   * @param req Request with user info
   * @returns The user's wallet balance
   */
  @Get('balance')
  async getBalance(@Req() req: RequestWithUser) {
    const userId = req.user.sub;
    const balance = await this.walletService.getBalance(userId);

    return ResponseUtil.success(
      {
        balance: balance,
      },
      'Balance retrieved successfully.',
    );
  }

  /**
   * Add balance to the current user's wallet
   * @param req Request with user info
   * @param addBalanceDto DTO containing amount to add
   * @returns Updated wallet information
   */
  @Post('add-balance')
  async addBalance(
    @Req() req: RequestWithUser,
    @Body() addBalanceDto: AddBalanceDto,
  ) {
    const userId = req.user.sub;

    try {
      const updatedWallet = await this.walletService.addBalance(
        userId,
        addBalanceDto.amount,
        addBalanceDto.payment_method as enums.PaymentMethod,
        addBalanceDto.reference_id,
        addBalanceDto.description,
      );

      return ResponseUtil.success(
        {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          amount_added: addBalanceDto.amount,
          payment_method: addBalanceDto.payment_method || 'manual',
          reference_id: addBalanceDto.reference_id,
          updated_at: updatedWallet.updated_at,
        },
        'Balance added successfully.',
      );
    } catch (error) {
      const err = error as Error;
      if (err.message === 'Wallet not found') {
        throw new HttpException('Wallet not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to add balance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Deduct balance from the current user's wallet
   * @param req Request with user info
   * @param deductBalanceDto DTO containing amount to deduct
   * @returns Updated wallet information
   */
  @Post('deduct-balance')
  async deductBalance(
    @Req() req: RequestWithUser,
    @Body() deductBalanceDto: DeductBalanceDto,
  ) {
    const userId = req.user.sub;

    try {
      const updatedWallet = await this.walletService.deductBalance(
        userId,
        deductBalanceDto.amount,
        deductBalanceDto.description,
      );

      return ResponseUtil.success(
        {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          amount_deducted: deductBalanceDto.amount,
          description: deductBalanceDto.description,
          updated_at: updatedWallet.updated_at,
        },
        'Balance deducted successfully.',
      );
    } catch (error) {
      const err = error as Error;
      if (err.message === 'Wallet not found') {
        throw new HttpException('Wallet not found', HttpStatus.NOT_FOUND);
      }
      if (err.message === 'Insufficient balance') {
        throw new HttpException('Insufficient balance', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Failed to deduct balance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get payment history for the current user's wallet
   * @param req Request with user info
   * @param limit Limit results (default: 20)
   * @param offset Offset for pagination (default: 0)
   * @returns Payment history
   */
  @Get('payment-history')
  async getPaymentHistory(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.sub;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    try {
      const payments = await this.walletService.getPaymentHistory(
        userId,
        limitNum,
        offsetNum,
      );
      const total = await this.walletService.getPaymentHistoryCount(userId);

      return ResponseUtil.success(
        {
          payments: payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            payment_method: p.payment_method,
            payment_status: p.payment_status,
            transaction_type: p.transaction_type,
            reference_id: p.reference_id,
            description: p.description,
            created_at: p.created_at,
            updated_at: p.updated_at,
          })),
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total,
            has_more: offsetNum + limitNum < total,
          },
        },
        'Payment history retrieved successfully.',
      );
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve payment history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get wallet summary with transaction statistics
   * @param req Request with user info
   * @returns Wallet summary
   */
  @Get('summary')
  async getWalletSummary(@Req() req: RequestWithUser) {
    const userId = req.user.sub;

    try {
      const summary = await this.walletService.getWalletSummary(userId);

      return ResponseUtil.success(
        {
          current_balance: summary.current_balance,
          total_topups: summary.total_topups,
          total_deductions: summary.total_deductions,
          transaction_count: summary.transaction_count,
          recent_transactions: summary.recent_transactions.map((p) => ({
            id: p.id,
            amount: p.amount,
            payment_method: p.payment_method,
            payment_status: p.payment_status,
            transaction_type: p.transaction_type,
            description: p.description,
            created_at: p.created_at,
          })),
        },
        'Wallet summary retrieved successfully.',
      );
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve wallet summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
