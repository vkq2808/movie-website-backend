// import { SeederModule } from './modules/seeder/seeder.module';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import {
  AuthModule,
  ChatModule,
  FeedbackModule,
  GenreModule,
  MovieModule,
  PaymentModule,
  MoviePurchaseModule,
  SearchHistoryModule,
  WalletModule,
  WatchHistoryModule,
  RedisModule,
  LanguageModule,
  WatchProviderModule,
  SettingsModule,
  UserModule,
  ProductionCompanyModule,
  RecommendationModule,
  AdminModule,
  CloudinaryModule,
  VideoModule,
  PersonModule,
  ImageModule,
  WatchPartyModule,
  TicketModule,
  TicketPurchaseModule,
  AIEmbeddingModule,
  FavoriteModule,
  MovieListModule,
} from '@/modules';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ReportModule } from './modules/report/report.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { LoggerMiddleware } from './middlewares/logger.middlewares';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './common/scheduleWorkers/test.schedule.service';
import { UploadCleanupService } from './common/scheduleWorkers/upload.cleanup.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import dotenv from 'dotenv';
import { KeywordModule } from './modules/keyword/keyword.module';

dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        ssl: false,
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ChatModule,
    FeedbackModule,
    GenreModule,
    MovieModule,
    PaymentModule,
    MoviePurchaseModule,
    SearchHistoryModule,
    WalletModule,
    WatchHistoryModule,
    RedisModule,
    ScheduleModule.forRoot(),
    CloudinaryModule,
    VideoModule,
    LanguageModule,
    WatchProviderModule,
    SettingsModule,
    UserModule,
    ProductionCompanyModule,
    RecommendationModule,
    // SeederModule,
    AdminModule,
    PersonModule,
    ImageModule,
    KeywordModule,
    WatchPartyModule,
    TicketModule,
    TicketPurchaseModule,
    AIEmbeddingModule,
    FavoriteModule,
    MovieListModule,
    AuditLogModule,
    FeatureFlagModule,
    RbacModule,
    ReportModule,
    ModerationModule,
  ],
  providers: [AppService, TasksService, UploadCleanupService],
  controllers: [AppController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
