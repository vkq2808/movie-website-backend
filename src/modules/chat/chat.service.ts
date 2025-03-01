import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CHAT_MODEL_NAME, Chat } from "./chat.schema";
import { Model } from "mongoose";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(CHAT_MODEL_NAME) private readonly model: Model<Chat>
  ) { }
}