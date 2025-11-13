import { BaseVoucher } from "./base-voucher";

export class FixedVoucher extends BaseVoucher {
  constructor(private value: number) {
    super();
  }

  calculateDiscount(originalPrice: number) {
    return Math.min(originalPrice, this.value);
  }

  isValid() {
    return this.value > 0;
  }
}