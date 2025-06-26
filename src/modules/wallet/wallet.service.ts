import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from './wallet.entity';
import { User } from '../auth/user.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

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
}
