import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import {
  ActorModule,
  AuthModule,
  ChatModule,
  DirectorModule,
  EpisodeModule,
  EpisodeServerModule,
  FeedbackModule,
  GenreModule,
  MovieModule,
  PaymentModule,
  SearchHistoryModule,
  WalletModule,
  WatchHistoryModule,
  RedisModule
} from '@/modules';
import { LoggerMiddleware } from './middlewares/logger.middlewares';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './common/scheduleWorkers/test.schedule.service';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { VideoModule } from './modules/video/video.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
require('dotenv').config();

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
        ssl: {
          rejectUnauthorized: false // Required for Supabase connections
        },
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    ActorModule,
    AuthModule,
    ChatModule,
    DirectorModule,
    EpisodeModule,
    EpisodeServerModule,
    FeedbackModule,
    GenreModule,
    MovieModule,
    PaymentModule,
    SearchHistoryModule,
    WalletModule,
    WatchHistoryModule,
    RedisModule,
    ScheduleModule.forRoot(),
    CloudinaryModule,
    VideoModule
  ],
  providers: [AppService, TasksService],
  controllers: [AppController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
