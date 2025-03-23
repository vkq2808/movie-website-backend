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
    RedisModule
  ],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
