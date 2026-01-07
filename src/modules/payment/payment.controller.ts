import {
  Controller,
  UseGuards,
  Post,
  Get,
  Body,
  Query,
  Param,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CheckoutDto } from './payment.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { TokenPayload } from '@/common/token-payload.type';
import { UserService } from '../user/user.service';
import { Request as ExpressRequest } from 'express';

type AuthenticatedRequest = ExpressRequest & {
  user: TokenPayload;
  ipv4?: string; // IP address from middleware (if available)
};

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
  ) { }

  /**
   * GET /payment/callback/vnpay - VNPay IPN callback endpoint (GET)
   * This route must be before @Get(':id') to avoid route conflict
   */
  @Get('callback/vnpay')
  @HttpCode(HttpStatus.OK)
  async vnpayCallbackGet(@Query() callbackParams: Record<string, string>) {
    const res = await this.handleVnpayCallback(callbackParams);
    return ResponseUtil.success(res, 'VNPay callback received successfully');
  }

  /**
   * POST /payment/checkout - Create payment and return payment URL
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkout(
    @Body() checkoutDto: CheckoutDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;

    // Get user entity
    const user = await this.userService.findById(userId);
    if (!user) {
      return ResponseUtil.error('User not found');
    }

    const ipAddr =
      req.ipv4 ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      (req.socket?.remoteAddress as string) ||
      '127.0.0.1';

    // Create checkout payment
    const payment = await this.paymentService.createCheckoutPayment(
      user,
      checkoutDto.amount,
      checkoutDto.currency,
      checkoutDto.payment_method,
      checkoutDto.return_url,
      ipAddr,
    );

    return ResponseUtil.success(
      {
        payment_id: payment.id,
        payment_url: payment.payment_url,
        amount: payment.amount,
        currency: payment.currency,
        payment_method: payment.payment_method,
      },
      'Payment checkout created successfully',
    );
  }

  /**
   * GET /payment/:id - Get payment by ID
   * Must be after callback routes to avoid conflict
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPayment(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    const payment = await this.paymentService.getPaymentById(id);

    if (!payment) {
      return ResponseUtil.error('Payment not found');
    }

    // Verify that the payment belongs to the authenticated user
    if (payment.user.id !== userId) {
      return ResponseUtil.error('Unauthorized access to payment');
    }

    return ResponseUtil.success(payment, 'Payment retrieved successfully');
  }

  /**
   * Handle VNPay callback (shared logic for GET and POST)
   */
  private async handleVnpayCallback(
    callbackParams: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    const payment = await this.paymentService.handleVnpayCallback(
      callbackParams,
    );

    if (!payment) {
      // Return error response according to VNPay specification
      return {
        RspCode: '97',
        Message: 'Invalid signature or payment not found',
      };
    }

    // Return success response according to VNPay specification
    return {
      RspCode: '00',
      Message: 'Success',
    };
  }
}
