import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../auth/user.entity';
import { MessageDto } from './chat.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
  ) {}

  // Simple temporary bot reply generator
  private generateBotReply(message: string): string {
    const text = message.trim().toLowerCase();
    if (!text) return 'Mình không nghe rõ, bạn có thể nói lại không?';
    // Treat wave emoji as greeting
    if (/(hi|hello|xin chào|👋)/.test(text))
      return 'Chào bạn! Mình có thể giúp gì hôm nay?';
    if (/giá|price/.test(text))
      return 'Bạn có thể xem giá trong trang chi tiết phim hoặc ví của bạn nhé.';
    if (/mua|purchase|buy/.test(text))
      return 'Để mua phim, hãy vào trang phim và bấm Mua/Watch Now.';
    if (/refund|hoàn tiền/.test(text))
      return 'Hiện tại chúng mình chưa hỗ trợ hoàn tiền tự động. Liên hệ hỗ trợ nhé!';
    return `Bạn vừa nói: "${message}". Mình sẽ sớm thông minh hơn để giúp bạn tốt hơn!`;
  }

  async sendMessage(messageDto: MessageDto, userId: string) {
    // Persist user message. Temporary routing: user chats with system -> receiver is self to satisfy not-null relation.
    const userRef = { id: userId } as Pick<User, 'id'>;
    const userMessage = this.chatRepository.create({
      message: messageDto.message,
      sender: userRef as unknown as User,
      receiver: userRef as unknown as User,
    });
    const savedUserMessage = await this.chatRepository.save(userMessage);

    // Generate a temporary bot reply (ephemeral, not persisted)
    const botReplyText = this.generateBotReply(messageDto.message);

    return {
      userMessage: {
        id: savedUserMessage.id,
        message: savedUserMessage.message,
        created_at: savedUserMessage.created_at,
      },
      botMessage: {
        id: null,
        message: botReplyText,
        created_at: new Date(),
      },
    };
  }
}
