import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { USER_MODEL_NAME } from "../auth";

export const CHAT_MODEL_NAME = 'Chat';

@Schema({ timestamps: true, collection: CHAT_MODEL_NAME })
export class Chat extends Document {
  @Prop({
    type: Types.ObjectId,
    refPath: USER_MODEL_NAME,
    required: [true, 'SenderId is required']
  })
  sender: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    refPath: USER_MODEL_NAME,
    required: [true, 'ReceiverId is required']
  })
  receiver: Types.ObjectId;

  @Prop({
    type: String,
    required: [true, 'Message is required']
  })
  message: string;

  @Prop({
    type: [{ type: String }],
    default: []
  })
  attachments: string[];
}

const ChatSchema = SchemaFactory.createForClass(Chat);

ChatSchema.pre('find', function () {
  this.populate('sender');
  this.populate('receiver');
});

ChatSchema.pre('findOne', function () {
  this.populate('sender');
  this.populate('receiver');
});

export { ChatSchema };