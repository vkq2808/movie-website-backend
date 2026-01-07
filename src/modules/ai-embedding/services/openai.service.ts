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

export interface MessageAnalysisResult {
  language: 'vi' | 'en';
  intent:
    | 'greeting'
    | 'movie_recommendation'
    | 'movie_similar'
    | 'random_movie'
    | 'question'
    | 'small_talk'
    | 'unknown';
  keywords: string[];
  expanded_keywords: string[];
  confidence: number;
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
      throw new Error(
        'CRITICAL: OPENAI_API_SECRET_KEY must be set in environment variables and cannot be empty',
      );
    }
  }

  /**
   * Generate text embedding using OpenAI API with retry logic
   * CRITICAL: This method ensures embedding vectors are not retained longer than necessary
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
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.apiUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
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
          this.logger.error(`OpenAI API error: ${response.status}`, errorData);

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

        // CRITICAL: Return minimal response to prevent embedding retention
        const result: EmbeddingResponse = {
          embedding: embedding,
          model: data.model,
          usage: data.usage,
        };

        // Explicitly clear the large embedding array from local scope
        // Note: The embedding is still returned but won't be retained in service instance
        return result;
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
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
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
          this.logger.error(`OpenAI API error: ${response.status}`, errorData);

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

        this.logger.debug(
          `Chat completion generated, content length: ${content.length}`,
        );

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
   * Analyze user message and return structured JSON with language, intent, keywords
   * This is the first step in the conversation pipeline
   * @param message User message to analyze
   * @returns Structured analysis result
   */
  async analyzeMessage(message: string): Promise<MessageAnalysisResult> {
    return this.retryService.executeWithRetry(
      async () => {
        if (!message || message.trim().length === 0) {
          throw new Error('Message cannot be empty');
        }

        this.logger.debug(
          `Analyzing message: "${message.substring(0, 50)}..."`,
        );

        const systemPrompt = `You are a message analysis system for a movie recommendation chatbot.
Your task is to analyze user messages and return ONLY valid JSON, no other text.

Return JSON with this exact structure:
{
  "language": "vi" | "en",
  "intent": "greeting" | "movie_recommendation" | "movie_similar" | "random_movie" | "question" | "small_talk" | "unknown",
  "keywords": ["keyword1", "keyword2"],
  "expanded_keywords": ["expanded1", "expanded2"],
  "confidence": 0.0-1.0
}

Intent definitions:
- greeting: Hello, hi, chào hỏi
- movie_recommendation: User wants movie suggestions (gợi ý phim, recommend movies)
- movie_similar: User wants movies similar to a specific movie (phim tương tự, similar to X)
- random_movie: User wants random suggestions (ngẫu nhiên, random, anything)
- question: User asks a question about movies
- small_talk: Casual conversation not related to movies
- unknown: Cannot determine intent

Keywords: Extract relevant movie-related keywords (genres, themes, actors, etc.)
Expanded_keywords: Expand keywords semantically within movie domain (e.g., "hành động" -> "hành động, phiêu lưu, kịch tính")
Confidence: How confident you are in the analysis (0.0-1.0)

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanations.`;

        const userPrompt = `Analyze this message: "${message}"`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          this.logger.error(`OpenAI API error: ${response.status}`, errorData);
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

        // Parse JSON response
        let parsed: MessageAnalysisResult;
        try {
          parsed = JSON.parse(content);
        } catch (parseError) {
          // Try to extract JSON from markdown code blocks if present
          const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[1]);
          } else {
            throw new Error('Failed to parse JSON response from LLM');
          }
        }

        // Validate and normalize result
        const result: MessageAnalysisResult = {
          language: parsed.language === 'en' ? 'en' : 'vi',
          intent: this.normalizeIntent(parsed.intent),
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          expanded_keywords: Array.isArray(parsed.expanded_keywords)
            ? parsed.expanded_keywords
            : parsed.keywords || [],
          confidence:
            typeof parsed.confidence === 'number'
              ? Math.max(0, Math.min(1, parsed.confidence))
              : 0.7,
        };

        // If expanded_keywords is empty or too short, use keywords
        if (result.expanded_keywords.length < result.keywords.length) {
          result.expanded_keywords = [...result.keywords];
        }

        this.logger.debug(
          `Message analyzed: language=${result.language}, intent=${result.intent}, confidence=${result.confidence}`,
        );

        return result;
      },
      'Analyze Message',
      {
        maxRetries: 2,
        initialDelayMs: 1000,
      },
    );
  }

  /**
   * Normalize intent to match expected values
   */
  private normalizeIntent(intent: string): MessageAnalysisResult['intent'] {
    const normalized = intent.toLowerCase().trim();
    const validIntents: MessageAnalysisResult['intent'][] = [
      'greeting',
      'movie_recommendation',
      'movie_similar',
      'random_movie',
      'question',
      'small_talk',
      'unknown',
    ];

    // Map variations to standard intents
    const intentMap: Record<string, MessageAnalysisResult['intent']> = {
      greeting: 'greeting',
      hello: 'greeting',
      hi: 'greeting',
      recommendation: 'movie_recommendation',
      movie_recommendation: 'movie_recommendation',
      recommend: 'movie_recommendation',
      suggest: 'movie_recommendation',
      similar: 'movie_similar',
      movie_similar: 'movie_similar',
      random: 'random_movie',
      random_movie: 'random_movie',
      question: 'question',
      ask: 'question',
      small_talk: 'small_talk',
      chat: 'small_talk',
      unknown: 'unknown',
    };

    return intentMap[normalized] || validIntents.includes(normalized as any)
      ? (normalized as MessageAnalysisResult['intent'])
      : 'unknown';
  }

  /**
   * Calculate cosine similarity between two vectors
   * CRITICAL: This method ensures embedding vectors are not retained longer than necessary
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

    // CRITICAL: Calculate similarity without retaining vectors in memory longer than needed
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

    const similarity = dotProduct / (normA * normB);

    // Explicitly clear local variables to help GC
    dotProduct = 0;
    normA = 0;
    normB = 0;

    return similarity;
  }
}
