import { BaseVoucher } from './base-voucher';

export class PercentVoucher extends BaseVoucher {
  constructor(private percent: number) {
    super();
  }

  calculateDiscount(originalPrice: number) {
    return (originalPrice * this.percent) / 100;
  }

  isValid() {
    return this.percent > 0 && this.percent <= 100;
  }
}
