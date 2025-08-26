import {
  Controller,
  UseGuards,
  Get,
  Post,
  Body,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { Request } from 'express';
import { TokenPayload } from '@/common';
import { AddBalanceDto, DeductBalanceDto } from './dto';
import { ResponseUtil } from '@/common/utils/response.util';

interface RequestWithUser extends Request {
  user: TokenPayload;
}

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
      );

      return ResponseUtil.success(
        {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          amount_added: addBalanceDto.amount,
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
      );

      return ResponseUtil.success(
        {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          amount_deducted: deductBalanceDto.amount,
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
}
