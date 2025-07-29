import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from './wallet.entity';
import { User } from '../auth/user.entity';
import { BadRequestException, InternalServerErrorException } from '@/exceptions';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
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
   * @returns The updated wallet
   */
  async addBalance(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    wallet.balance = Number(wallet.balance) + Number(amount);
    return this.walletRepository.save(wallet);
  }

  /**
   * Deduct balance from user's wallet
   * @param userId The user ID
   * @param amount The amount to deduct
   * @returns The updated wallet
   */
  async deductBalance(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    if (Number(wallet.balance) < Number(amount)) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.balance = Number(wallet.balance) - Number(amount);
    return this.walletRepository.save(wallet);
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
}
