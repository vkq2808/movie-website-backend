import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '@/modules/auth';
import { MovieModule } from '@/modules/movie';
import { ActorModule } from '@/modules/actor';
import { DirectorModule } from '@/modules/director';
import { ChatModule, EpisodeModule, EpisodeServerModule, FeedbackModule, GenreModule, PaymentModule, SearchHistoryModule, WalletModule, WatchHistoryModule } from './modules';
import { LoggerMiddleware } from './middlewares/logger.middlewares';
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
