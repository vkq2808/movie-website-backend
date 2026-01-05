import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { ConversationSession } from '../entities/conversation-session.entity';
import { Chat } from '@/modules/chat/chat.entity';
import { User } from '@/modules/user/user.entity';

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  language?: 'vi' | 'en';
  messageHistory: Array<{
    role: 'user' | 'assistant';
    text: string;
    ts: number;
  }>;
  suggestedMovieIds: string[];
  preferences?: {
    genres?: string[];
    actors?: string[];
  };
  lastIntent?: string;
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger('ConversationContextService');
  private redis: Redis | null = null;
  private readonly CONTEXT_TTL: number;
  private readonly MAX_HISTORY_LENGTH = 10;

  constructor(
    @InjectRepository(ConversationSession)
    private readonly sessionRepository: Repository<ConversationSession>,
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    private readonly configService: ConfigService,
  ) {
    this.CONTEXT_TTL = parseInt(
      this.configService.get<string>('CONTEXT_TTL_SECONDS', '1800'),
      10,
    );
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (redisUrl) {
        this.redis = new Redis(redisUrl);
        this.logger.log('Redis connected successfully');
      } else {
        this.logger.warn('Redis URL not configured, using DB fallback only');
      }
    } catch (error) {
      this.logger.error('Redis connection failed:', error);
      this.redis = null;
    }
  }

  /**
   * Get or create conversation context
   */
  async getOrCreate(
    sessionId: string,
    userId?: string,
  ): Promise<ConversationContext> {
    // Try Redis first
    if (this.redis) {
      const cached = await this.getFromRedis(sessionId);
      if (cached) {
        this.logger.debug(
          `Retrieved context from Redis for session: ${sessionId}`,
        );
        return cached;
      }
    }

    // Fallback to DB
    const dbContext = await this.getFromDatabase(sessionId, userId);
    if (dbContext) {
      this.logger.debug(`Retrieved context from DB for session: ${sessionId}`);
      // Cache in Redis for future requests
      if (this.redis) {
        await this.saveToRedis(dbContext);
      }
      return dbContext;
    }

    // Create new context with proper UUID
    const newSessionId = sessionId || uuidv4();
    const newContext: ConversationContext = {
      sessionId: newSessionId,
      userId,
      language: 'vi', // default
      messageHistory: [],
      suggestedMovieIds: [],
      preferences: {},
      lastIntent: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save to DB
    await this.saveToDatabase(newContext);

    // Cache in Redis
    if (this.redis) {
      await this.saveToRedis(newContext);
    }

    this.logger.debug(`Created new context for session: ${sessionId}`);
    return newContext;
  }

  /**
   * Update conversation context
   */
  async update(context: ConversationContext): Promise<void> {
    context.updatedAt = Date.now();

    // Update in DB
    await this.updateDatabase(context);

    // Update in Redis
    if (this.redis) {
      await this.saveToRedis(context);
    }
  }

  /**
   * Get context from Redis
   */
  private async getFromRedis(
    sessionId: string,
  ): Promise<ConversationContext | null> {
    try {
      if (!this.redis) return null;

      const key = this.getRedisKey(sessionId);
      const data = await this.redis.get(key);

      if (!data) return null;

      const context = JSON.parse(data) as ConversationContext;
      return context;
    } catch (error) {
      this.logger.error(
        `Failed to get context from Redis for session ${sessionId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Save context to Redis
   */
  private async saveToRedis(context: ConversationContext): Promise<void> {
    try {
      if (!this.redis) return;

      const key = this.getRedisKey(context.sessionId);
      await this.redis.setex(key, this.CONTEXT_TTL, JSON.stringify(context));
    } catch (error) {
      this.logger.error(
        `Failed to save context to Redis for session ${context.sessionId}:`,
        error,
      );
    }
  }

  /**
   * Get context from database
   */
  private async getFromDatabase(
    sessionId: string,
    userId?: string,
  ): Promise<ConversationContext | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!session) return null;

      // Build message history from Chat table (last N messages)
      const messageHistory = await this.buildMessageHistory(sessionId, userId);

      return {
        sessionId: session.id,
        userId: session.userId || userId,
        language: session.language,
        messageHistory,
        suggestedMovieIds: session.suggestedMovieIds || [],
        preferences: session.preferences || {},
        lastIntent: session.lastIntent,
        createdAt: session.createdAt.getTime(),
        updatedAt: session.updatedAt.getTime(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get context from DB for session ${sessionId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Save context to database
   */
  private async saveToDatabase(context: ConversationContext): Promise<void> {
    try {
      const session = this.sessionRepository.create({
        id: context.sessionId,
        userId: context.userId,
        language: context.language || 'vi',
        messageHistory: context.messageHistory,
        suggestedMovieIds: context.suggestedMovieIds,
        preferences: context.preferences,
        lastIntent: context.lastIntent,
      });

      await this.sessionRepository.save(session);
    } catch (error) {
      this.logger.error(
        `Failed to save context to DB for session ${context.sessionId}:`,
        error,
      );
    }
  }

  /**
   * Update context in database
   */
  private async updateDatabase(context: ConversationContext): Promise<void> {
    try {
      await this.sessionRepository.update(
        { id: context.sessionId },
        {
          userId: context.userId,
          language: context.language || 'vi',
          messageHistory: context.messageHistory,
          suggestedMovieIds: context.suggestedMovieIds,
          preferences: context.preferences,
          lastIntent: context.lastIntent,
          updatedAt: new Date(),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update context in DB for session ${context.sessionId}:`,
        error,
      );
    }
  }

  /**
   * Build message history from Chat table
   */
  private async buildMessageHistory(
    sessionId: string,
    userId?: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; text: string; ts: number }>> {
    try {
      // Get last N messages from Chat table for this session/user
      const messages = await this.chatRepository.find({
        where: { sender: { id: userId } },
        order: { created_at: 'DESC' },
        take: this.MAX_HISTORY_LENGTH,
      });

      // Convert to context format
      const history = messages
        .map((msg) => ({
          role: 'user' as const,
          text: msg.message,
          ts: msg.created_at.getTime(),
        }))
        .reverse(); // Oldest first

      return history;
    } catch (error) {
      this.logger.error(
        `Failed to build message history for session ${sessionId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Add message to context
   */
  addMessage(
    context: ConversationContext,
    role: 'user' | 'assistant',
    text: string,
  ): void {
    const message = {
      role,
      text,
      ts: Date.now(),
    };

    context.messageHistory.push(message);

    // Keep only last N messages
    if (context.messageHistory.length > this.MAX_HISTORY_LENGTH) {
      context.messageHistory = context.messageHistory.slice(
        -this.MAX_HISTORY_LENGTH,
      );
    }

    context.updatedAt = Date.now();
  }

  /**
   * Add suggested movie to context
   */
  addSuggestedMovie(context: ConversationContext, movieId: string): void {
    if (!context.suggestedMovieIds.includes(movieId)) {
      context.suggestedMovieIds.push(movieId);
      context.updatedAt = Date.now();
    }
  }

  /**
   * Update preferences in context
   */
  updatePreferences(
    context: ConversationContext,
    preferences: { genres?: string[]; actors?: string[] },
  ): void {
    context.preferences = {
      ...context.preferences,
      ...preferences,
    };
    context.updatedAt = Date.now();
  }

  /**
   * Get Redis key for session
   */
  private getRedisKey(sessionId: string): string {
    return `conv:${sessionId}`;
  }

  /**
   * Clean up context (optional)
   */
  async cleanup(sessionId: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(this.getRedisKey(sessionId));
      }
      // Note: We don't delete from DB to maintain audit trail
    } catch (error) {
      this.logger.error(
        `Failed to cleanup context for session ${sessionId}:`,
        error,
      );
    }
  }
}
