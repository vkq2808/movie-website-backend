import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AdminUserService } from './admin-user.service';
import { VoucherModule } from '../voucher/voucher.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Movie]),
    VoucherModule,
    forwardRef(() => AuthModule),
    RedisModule,
    AuditLogModule,
  ],
  controllers: [UserController],
  providers: [UserService, AdminUserService],
  exports: [UserService, AdminUserService],
})
export class UserModule {}
