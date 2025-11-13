import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Voucher } from "./entities/voucher.entity";
import { UserVoucher } from "./entities/user-voucher.entity";
import { VoucherController } from "./voucher.controller";
import { VoucherService } from "./voucher.service";


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Voucher,
      UserVoucher
    ]),
  ],
  exports: [
    VoucherService
  ],
  controllers: [
    VoucherController
  ],
  providers: [
    VoucherService
  ]
})
export class VoucherModule {

}