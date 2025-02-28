import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '@/auth';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URL ?? "YOUR_MONGO_URL"),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
