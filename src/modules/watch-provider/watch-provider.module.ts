import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchProvider } from './watch-provider.entity';
import { WatchProviderService } from './services/watch-provider.service';
import { WatchProviderController } from './watch-provider.controller';
import { Movie } from '../movie/entities/movie.entity';
import { R2Service } from './services/r2.service';

@Module({
  imports: [TypeOrmModule.forFeature([WatchProvider, Movie])],
  controllers: [WatchProviderController],
  providers: [WatchProviderService, R2Service],
  exports: [WatchProviderService, R2Service],
})
export class WatchProviderModule {
  constructor(private readonly providerService: WatchProviderService) {}
  async onModuleInit() {
    await this.providerService.syncDefaultProviders();
  }
}
