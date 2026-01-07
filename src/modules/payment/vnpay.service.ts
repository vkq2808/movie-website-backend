import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as querystring from 'querystring';

export interface VNPayPaymentParams {
  amount: number; // Amount in VND
  orderId: string; // Order ID (payment ID)
  orderDescription: string;
  returnUrl: string;
  ipnUrl: string;
  ipAddr: string; // Client IP address
}

export interface VNPayCallbackParams {
  [key: string]: string;
}

@Injectable()
export class VNPayService {
  private readonly logger = new Logger(VNPayService.name);
  private readonly vnpUrl: string;
  private readonly vnpTmnCode: string;
  private readonly vnpHashSecret: string;
  private readonly vnpVersion: string = '2.1.0';
  private readonly vnpCommand: string = 'pay';
  private readonly vnpCurrCode: string = 'VND';
  private readonly vnpLocale: string = 'vn';
  private readonly vnpOrderType: string = 'other';

  // Exchange rate USD to VND (can be updated or fetched from external API)
  // TODO: Fetch from external API
  private readonly USD_TO_VND_RATE = 25000;

  constructor(private configService: ConfigService) {
    this.vnpUrl =
      this.configService.get<string>('VNPAY_URL') ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    this.vnpTmnCode =
      this.configService.get<string>('VNPAY_TMN_CODE') || '';
    this.vnpHashSecret =
      this.configService.get<string>('VNPAY_HASH_SECRET') || '';

    if (!this.vnpTmnCode || !this.vnpHashSecret) {
      this.logger.warn(
        'VNPay credentials not configured. VNPAY_TMN_CODE and VNPAY_HASH_SECRET should be set in environment variables.',
      );
    }
  }

  /**
   * Convert USD to VND
   */
  convertUsdToVnd(usdAmount: number): number {
    return Math.round(usdAmount * this.USD_TO_VND_RATE);
  }

  /**
   * Create payment URL for VNPay
   */
  createPaymentUrl(params: VNPayPaymentParams): string {
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(
      new Date(date.getTime() + 15 * 60 * 1000),
    );

    const orderId = params.orderId;

    const vnpParams: Record<string, string> = {
      vnp_Version: this.vnpVersion,
      vnp_Command: this.vnpCommand,
      vnp_TmnCode: this.vnpTmnCode,
      vnp_Locale: this.vnpLocale,
      vnp_CurrCode: this.vnpCurrCode,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: params.orderId,
      vnp_OrderType: this.vnpOrderType,
      vnp_Amount: (params.amount * 100).toString(),
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = Object.keys(sortedParams)
      .map((key) => `${key}=${sortedParams[key]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    sortedParams['vnp_SecureHash'] = signed;

    const paymentUrl = `${this.vnpUrl}?${Object.keys(sortedParams)
      .map((key) => `${key}=${sortedParams[key]}`)
      .join('&')}`;
    return paymentUrl;
  }

  /**
   * Verify IPN callback signature from VNPay
   */
  verifyIpnCallback(params: VNPayCallbackParams): boolean {
    try {
      const secureHash = params.vnp_SecureHash;
      const secureHashType = params.vnp_SecureHashType;
      
      // Create a copy and remove hash fields
      const paramsCopy: Record<string, string> = { ...params };
      delete paramsCopy.vnp_SecureHash;
      delete paramsCopy.vnp_SecureHashType;

      // Sort params by key (encoded keys)
      const sortedParams = this.sortObject(paramsCopy);

      // Create query string manually (already encoded in sortObject)
      const signData = Object.keys(sortedParams)
        .map((key) => `${key}=${sortedParams[key]}`)
        .join('&');

      // Create secure hash using SHA512
      const hmac = crypto.createHmac('sha512', this.vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      // Compare hashes
      return secureHash === signed;
    } catch (error) {
      this.logger.error('Error verifying VNPay IPN callback:', error);
      return false;
    }
  }

  /**
   * Extract response code from VNPay callback
   * @returns Response code (00 = success)
   */
  getResponseCode(params: VNPayCallbackParams): string {
    return params.vnp_ResponseCode || '';
  }

  /**
   * Extract transaction ID from VNPay callback
   */
  getTransactionId(params: VNPayCallbackParams): string {
    return params.vnp_TransactionNo || '';
  }

  /**
   * Extract order ID from VNPay callback
   */
  getOrderId(params: VNPayCallbackParams): string {
    return params.vnp_TxnRef || '';
  }

  /**
   * Extract amount from VNPay callback (in smallest currency unit as sent to VNPay)
   * VNPay sends vnp_Amount = amount * 100
   */
  getAmount(params: VNPayCallbackParams): number | null {
    const raw = params.vnp_Amount;
    if (!raw) {
      return null;
    }

    const value = Number(raw);
    if (Number.isNaN(value)) {
      this.logger.warn(
        `Invalid vnp_Amount in callback: "${raw}". Skipping amount validation.`,
      );
      return null;
    }

    return value;
  }

  /**
   * Format date to VNPay format (yyyyMMddHHmmss)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Sort object by key (encode keys and values, then sort)
   * This matches VNPay's expected format
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const str: string[] = [];
    let key: string;

    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();

    for (let i = 0; i < str.length; i++) {
      const decodedKey = decodeURIComponent(str[i]);
      sorted[str[i]] = encodeURIComponent(obj[decodedKey]).replace(/%20/g, '+');
    }

    return sorted;
  }
}

