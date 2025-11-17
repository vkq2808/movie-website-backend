import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/user/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { VoucherModule } from '../voucher/voucher.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), VoucherModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
