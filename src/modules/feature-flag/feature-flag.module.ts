import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';
import { RedisModule } from '@/modules/redis/redis.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeatureFlag]),
    RedisModule,
    UserModule,
  ],
  providers: [FeatureFlagService],
  controllers: [FeatureFlagController],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}

