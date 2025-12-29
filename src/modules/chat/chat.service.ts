import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';
import { MessageDto } from './chat.dto';
import { AIEmbeddingService } from '@/modules/ai-embedding/ai-embedding.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger('ChatService');

  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    private readonly aiEmbeddingService: AIEmbeddingService,
  ) { }

  /**
   * Persist user message and get AI-driven reply via AIEmbeddingService
   */
  async sendMessage(messageDto: MessageDto, userId: string) {
    const userRef = { id: userId } as Pick<User, 'id'>;

    const userMessage = this.chatRepository.create({
      message: messageDto.message,
      sender: userRef as unknown as User,
      receiver: userRef as unknown as User,
    });

    const savedUserMessage = await this.chatRepository.save(userMessage);

    // Ask AIEmbeddingService for a controlled reply
    const aiResult = await this.aiEmbeddingService.answerUserMessage(messageDto.message);

    if (aiResult.status === 'success' && aiResult.botMessage) {
      return {
        userMessage: {
          id: savedUserMessage.id,
          message: savedUserMessage.message,
          created_at: savedUserMessage.created_at,
        },
        botMessage: {
          id: null,
          message: aiResult.botMessage.message,
          created_at: new Date(),
        },
      };
    }

    if (aiResult.status === 'offtopic' && aiResult.botMessage) {
      return {
        userMessage: {
          id: savedUserMessage.id,
          message: savedUserMessage.message,
          created_at: savedUserMessage.created_at,
        },
        botMessage: {
          id: null,
          message: aiResult.botMessage.message,
          created_at: new Date(),
        },
      };
    }

    // On error, return neutral safe message
    this.logger.warn('AI returned error: ' + JSON.stringify(aiResult.error));
    return {
      userMessage: {
        id: savedUserMessage.id,
        message: savedUserMessage.message,
        created_at: savedUserMessage.created_at,
      },
      botMessage: {
        id: null,
        message: 'Xin lỗi, hiện tại hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
        created_at: new Date(),
      },
    };
  }
}
