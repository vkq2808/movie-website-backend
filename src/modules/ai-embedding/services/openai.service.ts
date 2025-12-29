import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetryService } from './retry.service';

interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface ChatCompletionResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger('OpenAIService');
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.openai.com/v1';
  private readonly timeoutMs = 30000;

  constructor(
    private configService: ConfigService,
    private retryService: RetryService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_SECRET_KEY') || '';
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('CRITICAL: OPENAI_API_SECRET_KEY must be set in environment variables and cannot be empty');
    }
  }

  /**
   * Generate text embedding using OpenAI API with retry logic
   * @param text Text to embed
   * @param model Embedding model (default: text-embedding-3-large)
   * @returns Embedding vector and metadata
   */
  async createEmbedding(
    text: string,
    model: string = 'text-embedding-3-large',
  ): Promise<EmbeddingResponse> {
    return this.retryService.executeWithRetry(
      async () => {
        if (!text || text.trim().length === 0) {
          throw new Error('Text cannot be empty');
        }

        this.logger.debug(
          `Creating embedding for text length: ${text.length}, model: ${model}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.timeoutMs,
        );

        const response = await fetch(`${this.apiUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: text,
            model: model,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          this.logger.error(
            `OpenAI API error: ${response.status}`,
            errorData,
          );

          if (response.status === 401) {
            throw new Error('Invalid OpenAI API key');
          }

          if (response.status === 429) {
            throw new Error('OpenAI rate limit exceeded');
          }

          if (response.status >= 500) {
            throw new Error('OpenAI service temporarily unavailable');
          }

          throw new Error(
            `OpenAI API error: ${errorData.error?.message || 'Unknown error'}`,
          );
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
          throw new Error('No embedding returned from OpenAI');
        }

        const embedding = data.data[0].embedding;

        this.logger.debug(
          `Embedding created successfully, dimension: ${embedding.length}`,
        );

        return {
          embedding: embedding,
          model: data.model,
          usage: data.usage,
        };
      },
      'Create Embedding',
      {
        maxRetries: 3,
        initialDelayMs: 1000,
      },
    );
  }

  /**
   * Chat completion for intent analysis and response generation with retry
   * @param messages Chat messages for context
   * @param model Model to use (default: gpt-4-turbo)
   * @param temperature Temperature for response (0-2)
   * @returns Chat completion response
   */
  async chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    model: string = 'gpt-4-turbo',
    temperature: number = 0.7,
  ): Promise<ChatCompletionResponse> {
    return this.retryService.executeWithRetry(
      async () => {
        if (!messages || messages.length === 0) {
          throw new Error('Messages cannot be empty');
        }

        this.logger.debug(
          `Chat completion with ${messages.length} messages, model: ${model}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.timeoutMs,
        );

        const response = await fetch(`${this.apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: 1000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          this.logger.error(
            `OpenAI API error: ${response.status}`,
            errorData,
          );

          if (response.status === 401) {
            throw new Error('Invalid OpenAI API key');
          }

          if (response.status === 429) {
            throw new Error('OpenAI rate limit exceeded');
          }

          if (response.status >= 500) {
            throw new Error('OpenAI service temporarily unavailable');
          }

          throw new Error(
            `OpenAI API error: ${errorData.error?.message || 'Unknown error'}`,
          );
        }

        const data = await response.json();

        if (
          !data.choices ||
          data.choices.length === 0 ||
          !data.choices[0].message
        ) {
          throw new Error('No completion returned from OpenAI');
        }

        const content = data.choices[0].message.content;

        this.logger.debug(`Chat completion generated, content length: ${content.length}`);

        return {
          content: content,
          model: data.model,
          usage: data.usage,
        };
      },
      'Chat Completion',
      {
        maxRetries: 2,
        initialDelayMs: 1000,
      },
    );
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vecA First vector
   * @param vecB Second vector
   * @returns Similarity score (0-1)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
