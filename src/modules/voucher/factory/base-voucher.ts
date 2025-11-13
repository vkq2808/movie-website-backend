export abstract class BaseVoucher {
  abstract calculateDiscount(originalPrice: number): number;
  abstract isValid(now?: Date): boolean;
}