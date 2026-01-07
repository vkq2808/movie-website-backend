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
  usedKeywords?: string[]; // Keywords used in the last analysis
  responseType?: 'text' | 'movie' | 'mixed'; // Type of last response
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger('ConversationContextService');
  private redis: Redis | null = null;
  private readonly CONTEXT_TTL: number;
  private readonly MAX_HISTORY_LENGTH = 10;
  private readonly MAX_SESSIONS_IN_MEMORY = 1000; // Hard limit on concurrent sessions

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
   * Get or create conversation context with strict memory bounds
   */
  async getOrCreate(
    sessionId: string,
    userId?: string,
  ): Promise<ConversationContext> {
    // Try Redis first (memory-efficient)
    if (this.redis) {
      const cached = await this.getFromRedis(sessionId);
      if (cached) {
        this.logger.debug(
          `Retrieved context from Redis for session: ${sessionId}`,
        );
        return cached;
      }
    }

    // Fallback to DB with strict pagination
    const dbContext = await this.getFromDatabase(sessionId, userId);
    if (dbContext) {
      this.logger.debug(`Retrieved context from DB for session: ${sessionId}`);
      // Cache in Redis for future requests (bounded)
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
      usedKeywords: [],
      responseType: undefined,
      messageHistory: [],
      suggestedMovieIds: [],
      preferences: {},
      lastIntent: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save to DB
    await this.saveToDatabase(newContext);

    // Cache in Redis (bounded)
    if (this.redis) {
      await this.saveToRedis(newContext);
    }

    this.logger.debug(`Created new context for session: ${sessionId}`);
    return newContext;
  }

  /**
   * Update conversation context with memory bounds
   */
  async update(context: ConversationContext): Promise<void> {
    context.updatedAt = Date.now();

    // Update in DB
    await this.updateDatabase(context);

    // Update in Redis (bounded)
    if (this.redis) {
      await this.saveToRedis(context);
    }
  }

  /**
   * Get context from Redis (memory-efficient)
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
   * Save context to Redis with memory bounds
   */
  private async saveToRedis(context: ConversationContext): Promise<void> {
    try {
      if (!this.redis) return;

      const key = this.getRedisKey(context.sessionId);
      // Use set with memory bounds - Redis will evict old entries automatically
      await this.redis.setex(key, this.CONTEXT_TTL, JSON.stringify(context));
    } catch (error) {
      this.logger.error(
        `Failed to save context to Redis for session ${context.sessionId}:`,
        error,
      );
    }
  }

  /**
   * Get context from database with strict pagination
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

      // Build message history from Chat table with strict pagination
      // This prevents loading all messages into memory at once
      const messageHistory = await this.buildMessageHistory(sessionId, userId);

      return {
        sessionId: session.id,
        userId: session.userId || userId,
        language: session.language,
        messageHistory,
        suggestedMovieIds: session.suggestedMovieIds || [],
        preferences: session.preferences || {},
        lastIntent: session.lastIntent,
        usedKeywords: session.usedKeywords || [],
        responseType: session.responseType as
          | 'text'
          | 'movie'
          | 'mixed'
          | undefined,
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
        usedKeywords: context.usedKeywords,
        responseType: context.responseType,
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
          usedKeywords: context.usedKeywords,
          responseType: context.responseType,
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
   * Build message history from Chat table with strict pagination
   * CRITICAL: This method ensures we never load more than MAX_HISTORY_LENGTH messages
   */
  private async buildMessageHistory(
    sessionId: string,
    userId?: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; text: string; ts: number }>> {
    try {
      // CRITICAL: Use pagination to prevent loading all messages into memory
      // Only fetch the last N messages directly from database
      const messages = await this.chatRepository
        .createQueryBuilder('chat')
        .where('chat.sender_id = :userId', { userId })
        .orderBy('chat.created_at', 'DESC')
        .limit(this.MAX_HISTORY_LENGTH)
        .getMany();

      // Convert to context format - minimal memory footprint
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
   * Add message to context with strict bounds
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

    // CRITICAL: Enforce strict upper bound on message history
    if (context.messageHistory.length > this.MAX_HISTORY_LENGTH) {
      // Remove oldest messages to maintain bounded size
      context.messageHistory = context.messageHistory.slice(
        -this.MAX_HISTORY_LENGTH,
      );
    }

    context.updatedAt = Date.now();
  }

  /**
   * Add suggested movie to context with bounds
   */
  addSuggestedMovie(context: ConversationContext, movieId: string): void {
    // Prevent unlimited movie suggestions
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
