import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { VNPayService } from './vnpay.service';
import { Payment } from './payment.entity';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Payment, User]),
    forwardRef(() => UserModule),
    forwardRef(() => WalletModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, VNPayService],
  exports: [PaymentService],
})
export class PaymentModule {}
