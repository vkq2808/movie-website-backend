import {
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
  Get,
  OnModuleInit,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AIChatMovieService } from '../services/ai-chat-movie.service';
import { MovieEmbeddingMigrationService } from '../services/movie-embedding-migration.service';
import { InputSanitizer } from '../services/input-sanitizer.service';
import {
  ChatMovieRequestDto,
  ChatMovieResponseDto,
  EmbeddingMigrationRequestDto,
  EmbeddingMigrationResponseDto,
  EmbeddingStatsDto,
  HealthCheckResponseDto,
  ErrorResponseDto,
} from '../dtos/ai-embedding.dto';

@ApiTags('AI Embedding & Chat')
@Controller('api/ai')
export class AIEmbeddingController implements OnModuleInit {
  private readonly logger = new Logger('AIEmbeddingController');

  constructor(
    private readonly aiChatMovieService: AIChatMovieService,
    private readonly embeddingMigrationService: MovieEmbeddingMigrationService,
    private readonly inputSanitizer: InputSanitizer,
  ) {}

  onModuleInit() {
    // this.embeddingMigrationService.migrateExistingMovies();
  }

  /**
   * Chat with AI about movies
   * POST /api/ai/chat/movie
   */
  @Post('chat/movie')
  @ApiOperation({
    summary: 'Chat with AI about movies',
    description:
      'Send a message about movies and get AI recommendations with related movies',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat response with related movies',
    type: ChatMovieResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'OpenAI service unavailable',
    type: ErrorResponseDto,
  })
  async chatAboutMovie(
    @Body() dto: ChatMovieRequestDto,
  ): Promise<ChatMovieResponseDto> {
    try {
      // SECURITY: Never log raw user input - use safe representation
      this.logger.log(
        `Chat request received (${this.inputSanitizer.getSafeLogRepresentation(dto.message).length} chars)`,
      );

      const result = await this.aiChatMovieService.chatAboutMovie(dto.message);

      return {
        userMessage: result.userMessage,
        response: result.response,
        relatedMovies: result.relatedMovies,
        intent: result.intent,
      };
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`);

      // Handle specific error types
      if (
        error.message.includes('OpenAI') ||
        error.message.includes('timeout')
      ) {
        throw new HttpException(
          {
            code: 'OPENAI_SERVICE_ERROR',
            message:
              'OpenAI service is currently unavailable. Please try again later.',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (error.message.includes('Invalid input')) {
        throw new HttpException(
          {
            code: 'INVALID_REQUEST',
            message:
              'Your message contains invalid characters or patterns. Please try a simpler question.',
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (error.message.includes('empty')) {
        throw new HttpException(
          {
            code: 'INVALID_REQUEST',
            message: error.message,
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get embedding stats
   * GET /api/ai/embedding/stats
   */
  @Get('embedding/stats')
  @ApiOperation({
    summary: 'Get embedding statistics',
    description: 'Get current stats on movie embeddings coverage',
  })
  @ApiResponse({
    status: 200,
    description: 'Embedding statistics',
    type: EmbeddingStatsDto,
  })
  async getEmbeddingStats(): Promise<EmbeddingStatsDto> {
    try {
      return await this.embeddingMigrationService.getStats();
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Start bulk embedding migration
   * POST /api/ai/embedding/migrate
   *
   * ⚠️ ADMIN/MANUAL OPERATION
   * This endpoint embeds all movies without embeddings
   * Takes time and makes multiple OpenAI API calls
   */
  @Post('embedding/migrate')
  @ApiOperation({
    summary: 'Start bulk movie embedding migration',
    description:
      "Embed all existing movies that don't have embeddings yet. ⚠️ Long-running operation! Only call this once or periodically to catch new movies.",
  })
  @ApiResponse({
    status: 200,
    description: 'Migration completed',
    type: EmbeddingMigrationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Migration not confirmed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'OpenAI service unavailable',
    type: ErrorResponseDto,
  })
  async migrateEmbeddings(
    @Body() dto: EmbeddingMigrationRequestDto,
  ): Promise<EmbeddingMigrationResponseDto> {
    try {
      if (!dto.confirm) {
        throw new HttpException(
          {
            code: 'MIGRATION_NOT_CONFIRMED',
            message: 'Migration must be confirmed with confirm: true',
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.warn('🚀 Bulk embedding migration started by user');

      const result =
        await this.embeddingMigrationService.migrateExistingMovies();

      const successPercentage =
        result.totalProcessed > 0
          ? Math.round((result.successful / result.totalProcessed) * 100)
          : 0;

      return {
        totalProcessed: result.totalProcessed,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        successPercentage,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Migration failed: ${error.message}`);

      if (
        error.message.includes('OpenAI') ||
        error.message.includes('timeout')
      ) {
        throw new HttpException(
          {
            code: 'OPENAI_SERVICE_ERROR',
            message: 'OpenAI service error during migration',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new HttpException(
        {
          code: 'MIGRATION_ERROR',
          message: 'Migration failed: ' + error.message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check for AI embedding system
   * GET /api/ai/health
   */
  @Get('health')
  @ApiOperation({
    summary: 'Health check for AI embedding system',
    description: 'Check if OpenAI and movie embedding systems are working',
  })
  @ApiResponse({
    status: 200,
    description: 'System health status',
    type: HealthCheckResponseDto,
  })
  async healthCheck(): Promise<HealthCheckResponseDto> {
    try {
      return await this.aiChatMovieService.healthCheck();
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        openaiAvailable: false,
        embeddingsAvailable: false,
        status: 'unhealthy',
      };
    }
  }
}
