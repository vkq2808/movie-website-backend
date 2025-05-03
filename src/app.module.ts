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
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './common/scheduleWorkers/test.schedule.service';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { VideoModule } from './modules/video/video.module';
require('dotenv').config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URL || "YOUR_MONGO_URL"),
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
