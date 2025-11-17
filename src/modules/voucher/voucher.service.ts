import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Voucher } from './entities/voucher.entity';
import { Repository } from 'typeorm';
import { BaseVoucher } from './factory/base-voucher';
import { VoucherFactory } from './factory/voucher.factory';

@Injectable()
export class VoucherService {
  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepo: Repository<Voucher>,
  ) {}
  async getAvailableVouchers(userId: string) {
    const valid: BaseVoucher[] = [];
    const vouchers = await this.voucherRepo.find();

    for (const voucher of vouchers) {
      const v = VoucherFactory.create(voucher);
      const isValid = await v.isValid();
      if (isValid) {
        valid.push(v);
      }
    }

    return valid;
  }
}
