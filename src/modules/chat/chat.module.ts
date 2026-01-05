import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from '@/modules/chat/chat.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationModule } from '@/modules/conversation/conversation.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Chat]),
    ConversationModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
