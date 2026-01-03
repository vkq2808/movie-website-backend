import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';
import { MessageDto } from './chat.dto';
import { AIEmbeddingService } from '@/modules/ai-embedding/ai-embedding.service';
import {
  LanguageDetectorService,
  SupportedLanguage,
} from '@/modules/ai-embedding/services/language-detector.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger('ChatService');

  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    private readonly aiEmbeddingService: AIEmbeddingService,
    private readonly languageDetector: LanguageDetectorService,
  ) {}

  /**
   * Persist user message and get AI-driven reply via AIEmbeddingService
   * Now with language detection for consistent VI/EN responses
   * Detected language is stored in chat entity for audit trail and future improvements
   */
  async sendMessage(messageDto: MessageDto, userId: string) {
    const userRef = { id: userId } as Pick<User, 'id'>;

    // Ask AIEmbeddingService for a controlled reply with language detection
    const aiResult = await this.aiEmbeddingService.answerUserMessage(
      messageDto.message,
    );

    const detectedLanguage: SupportedLanguage =
      aiResult.detectedLanguage || 'vi';

    // Create and persist user message with detected language
    const userMessage = this.chatRepository.create({
      message: messageDto.message,
      sender: userRef as unknown as User,
      receiver: userRef as unknown as User,
      detected_language: detectedLanguage, // NEW: Store detected language
    });

    const savedUserMessage = await this.chatRepository.save(userMessage);

    // Handle success response
    if (aiResult.status === 'success' && aiResult.botMessage) {
      return {
        userMessage: {
          id: savedUserMessage.id,
          message: savedUserMessage.message,
          created_at: savedUserMessage.created_at,
          language: detectedLanguage,
        },
        botMessage: {
          id: null,
          message: aiResult.botMessage.message,
          created_at: new Date(),
          language: detectedLanguage,
        },
      };
    }

    // Handle off-topic response
    if (aiResult.status === 'offtopic' && aiResult.botMessage) {
      return {
        userMessage: {
          id: savedUserMessage.id,
          message: savedUserMessage.message,
          created_at: savedUserMessage.created_at,
          language: detectedLanguage,
        },
        botMessage: {
          id: null,
          message: aiResult.botMessage.message,
          created_at: new Date(),
          language: detectedLanguage,
        },
      };
    }

    // Handle error - return language-appropriate error message
    this.logger.warn('AI returned error: ' + JSON.stringify(aiResult.error));
    const errorMessage =
      this.languageDetector.getErrorMessage(detectedLanguage);

    return {
      userMessage: {
        id: savedUserMessage.id,
        message: savedUserMessage.message,
        created_at: savedUserMessage.created_at,
        language: detectedLanguage,
      },
      botMessage: {
        id: null,
        message: errorMessage,
        created_at: new Date(),
        language: detectedLanguage,
      },
    };
  }
}
