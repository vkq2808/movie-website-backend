import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { MessageDto } from './chat.dto';
import { Request } from 'express';
import { TokenPayload } from '@/common';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post('send')
  async sendMessage(
    @Body() messageDto: MessageDto,
    @Req() req: Request & { user: TokenPayload },
  ) {
    const userId = req.user?.sub;
    const result = await this.chatService.sendMessage(messageDto, userId);

    // Unified response contract
    if (result && result.botMessage && typeof result.botMessage.message === 'string') {
      return {
        status: 'success',
        data: {
          botMessage: {
            message: result.botMessage.message,
          },
        },
      };
    }

    // Fallback error
    return {
      status: 'error',
      error: {
        code: 'UNKNOWN',
        message: 'An unexpected error occurred',
      },
    };
  }
}
