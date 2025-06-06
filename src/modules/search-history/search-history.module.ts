import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchHistoryController } from './search-history.controller';
import { SearchHistoryService } from './search-history.service';
import { SearchHistory } from './search-history.entity';
import { User } from '../auth/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([SearchHistory, User]),
  ],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService],
})
export class SearchHistoryModule {}
