import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Chat } from "./chat.schema";
import { Model } from "mongoose";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(modelNames.CHAT_MODEL_NAME) private readonly model: Model<Chat>
  ) { }
}