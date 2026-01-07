import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request DTO for chat about movies
 */
export class ChatMovieRequestDto {
  @ApiProperty({
    description: 'User message about movies',
    example: 'Tôi thích phim khoa học viễn tưởng về thời gian và không gian',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MinLength(1, { message: 'Message must be at least 1 character' })
  @MaxLength(2000, { message: 'Message must not exceed 2000 characters' })
  message: string;
}

/**
 * Response DTO for related movie
 */
export class RelatedMovieDto {
  @ApiProperty({ description: 'Movie ID', example: 'uuid-here' })
  id?: string;

  @ApiProperty({
    description: 'Movie title',
    example: 'Interstellar',
  })
  title?: string;

  @ApiProperty({
    description: 'Movie overview/synopsis',
    example: 'A team of explorers travel through a wormhole...',
  })
  overview?: string;

  @ApiProperty({
    description: 'Similarity score (0-1)',
    example: 0.87,
  })
  similarity: number;
}

/**
 * Response DTO for chat about movies
 */
export class ChatMovieResponseDto {
  @ApiProperty({
    description: 'Original user message',
    example: 'Tôi thích phim khoa học viễn tưởng',
  })
  userMessage: string;

  @ApiProperty({
    description: 'AI response',
    example: 'Dựa trên những gì bạn nói, mình gợi ý một số bộ phim sau...',
  })
  response: string;

  @ApiProperty({
    description: 'Related movies found',
    type: [RelatedMovieDto],
  })
  relatedMovies: RelatedMovieDto[];

  @ApiProperty({
    description: 'Intent analysis result',
    type: Object,
  })
  intent: {
    isMovieRelated: boolean;
    keywords: string[];
    explicitMovie: string | null;
  };
}

/**
 * Request DTO for bulk embedding migration
 */
export class EmbeddingMigrationRequestDto {
  @ApiProperty({
    description: 'Confirm migration (required)',
    example: true,
  })
  confirm: boolean;
}

/**
 * Response DTO for bulk embedding migration
 */
export class EmbeddingMigrationResponseDto {
  @ApiProperty({ description: 'Total movies processed', example: 1000 })
  totalProcessed: number;

  @ApiProperty({ description: 'Successfully embedded', example: 950 })
  successful: number;

  @ApiProperty({ description: 'Failed to embed', example: 10 })
  failed: number;

  @ApiProperty({
    description: 'Movies that already had embeddings',
    example: 40,
  })
  skipped: number;

  @ApiProperty({
    description: 'Success percentage',
    example: 95,
  })
  successPercentage: number;
}

/**
 * Response DTO for embedding stats
 */
export class EmbeddingStatsDto {
  @ApiProperty({
    description: 'Total movies in database',
    example: 1000,
  })
  totalMovies: number;

  @ApiProperty({
    description: 'Movies with embeddings',
    example: 950,
  })
  moviesWithEmbeddings: number;

  @ApiProperty({
    description: 'Movies without embeddings',
    example: 50,
  })
  moviesWithoutEmbeddings: number;

  @ApiProperty({
    description: 'Embedding coverage percentage',
    example: 95,
  })
  percentage: number;
}

/**
 * Response DTO for health check
 */
export class HealthCheckResponseDto {
  @ApiProperty({
    description: 'OpenAI API availability',
    example: true,
  })
  openaiAvailable: boolean;

  @ApiProperty({
    description: 'Movie embeddings availability',
    example: true,
  })
  embeddingsAvailable: boolean;

  @ApiProperty({
    description: 'Overall system status',
    example: 'healthy',
    enum: ['healthy', 'degraded', 'unhealthy'],
  })
  status: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Error Response DTO
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'Error code', example: 'OPENAI_SERVICE_ERROR' })
  code: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'OpenAI service is currently unavailable',
  })
  message: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 503,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Timestamp of error',
    example: '2024-12-29T10:00:00Z',
  })
  timestamp: string;
}
