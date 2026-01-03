import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from '@/modules/chat/chat.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AIEmbeddingModule } from '../ai-embedding';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Chat]),
    AIEmbeddingModule
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule { }
