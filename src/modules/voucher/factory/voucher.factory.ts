
import { PercentVoucher } from './percent-voucher';
import { FixedVoucher } from './fixed-voucher';
import { Voucher, VoucherType } from '../entities/voucher.entity';
import { BaseVoucher } from './base-voucher';

export class VoucherFactory {
  static create(voucher: Voucher): BaseVoucher {
    switch (voucher.type) {
      case VoucherType.PERCENT:
        return new PercentVoucher(Number(voucher.value));
      case VoucherType.FIXED:
        return new FixedVoucher(Number(voucher.value));
      default:
        throw new Error('Unsupported voucher type');
    }
  }
}