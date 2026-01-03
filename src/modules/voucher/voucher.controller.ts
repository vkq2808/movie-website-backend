import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequestWithUser } from '../auth/auth.interface';
import { VoucherService } from './voucher.service';
import { ResponseUtil } from '@/common';

@Controller('voucher')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) { }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMyVoucher(@Req() req: RequestWithUser) {
    const user = req.user;
    const userId = user.sub; // hoặc user.id nếu bạn map JWT payload như vậy
    console.log(userId);
    // Gọi service để lấy danh sách voucher khả dụng
    const vouchers = await this.voucherService.getAvailableVouchers(userId);
    console.log(vouchers);

    return ResponseUtil.success(vouchers, 'Danh sách voucher khả dụng');
  }
}
