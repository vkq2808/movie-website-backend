import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Chat } from "@/modules/chat/chat.entity";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Chat])
  ],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule { }