import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CHAT_MODEL_NAME, ChatSchema } from "@/modules/chat/chat.schema";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: CHAT_MODEL_NAME, schema: ChatSchema }
    ])
  ],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule { }