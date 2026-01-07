import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';
import { MessageDto } from './chat.dto';
import { ConversationFlowService } from '@/modules/conversation/services/conversation-flow.service';
import { ConversationContextService } from '@/modules/conversation/services/conversation-context.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatService {
  private readonly logger = new Logger('ChatService');

  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    private readonly conversationFlow: ConversationFlowService,
    private readonly contextService: ConversationContextService,
  ) { }

  /**
   * Persist user message and get conversational AI-driven reply
   * Now with multi-turn conversation support, intent classification, and context management
   */
  async sendMessage(
    messageDto: MessageDto,
    userId: string,
    sessionId?: string,
  ) {
    const userRef = { id: userId } as Pick<User, 'id'>;

    try {
      // Use conversation flow service for multi-turn support
      const conversationResult = await this.conversationFlow.process(
        messageDto.message,
        sessionId,
        userId,
      );

      // Create and persist user message with detected language
      const detectedLanguage = conversationResult.language || 'vi';
      const userMessage = this.chatRepository.create({
        message: messageDto.message,
        sender: userRef as unknown as User,
        receiver: userRef as unknown as User,
        detected_language: detectedLanguage,
      });

      const savedUserMessage = await this.chatRepository.save(userMessage);

      return {
        userMessage: {
          id: savedUserMessage.id,
          message: savedUserMessage.message,
          created_at: savedUserMessage.created_at,
          language: detectedLanguage,
        },
        botMessage: conversationResult.botMessage,
        sessionId: conversationResult.sessionId,
        suggestedKeywords: conversationResult.suggestedKeywords,
      };
    } catch (error) {
      this.logger.error('Chat service failed:', error);
      return {
        userMessage: {
          id: null,
          message: messageDto.message,
          created_at: new Date(),
          language: 'vi',
        },
        botMessage: {
          message: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
        },
        sessionId: sessionId || this.generateSessionId(),
        suggestedKeywords: ['gợi ý phim', 'phim mới', 'phim hay'],
      };
    }
  }

  /**
   * Generate new session ID
   */
  private generateSessionId(): string {
    return uuidv4();
  }
}
