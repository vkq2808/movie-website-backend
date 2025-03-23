import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ChatSchema } from "@/modules/chat/chat.schema";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { modelNames } from "@/common/constants/model-name.constant";


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: modelNames.CHAT_MODEL_NAME, schema: ChatSchema }
    ])
  ],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule { }