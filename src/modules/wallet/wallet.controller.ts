import { Controller, UseGuards, Get, Req, HttpException, HttpStatus } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { Request } from 'express';
import { TokenPayload } from '@/common';

interface RequestWithUser extends Request {
  user: TokenPayload;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) { }

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

    return {
      id: wallet.id,
      balance: wallet.balance,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at
    };
  }
}
