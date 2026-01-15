import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { MovieEmbeddingService } from './movie-embedding.service';
import { InputSanitizer } from './input-sanitizer.service';
import { TextPreprocessingService } from './text-preprocessing.service';
import { Movie } from '@/modules/movie/entities/movie.entity';

interface IntentAnalysisResult {
  isQuestion: boolean;
  isMovieRelated: boolean;
  keywords: string[];
  explicitMovie: string | null;
  mood: string | null;
  confidence: number;
}

interface MovieChatContext {
  userMessage: string;
  intent: IntentAnalysisResult;
  relatedMovies: { movie: Partial<Movie>; similarity: number }[];
}

@Injectable()
export class AIChatMovieService {
  private readonly logger = new Logger('AIChatMovieService');

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly inputSanitizer: InputSanitizer,
    private readonly textPreprocessing: TextPreprocessingService,
  ) { }

  /**
   * Step 1: Analyze user intent and context
   * Determine if message is movie-related and extract keywords
   */
  async analyzeIntent(userMessage: string): Promise<IntentAnalysisResult> {
    try {
      // SECURITY: Sanitize user input before processing
      const sanitizationResult =
        this.inputSanitizer.sanitizeUserInput(userMessage);
      if (!sanitizationResult.isValid) {
        this.logger.warn(
          `Invalid user input detected: ${sanitizationResult.reason}. Safe: ${this.inputSanitizer.getSafeLogRepresentation(userMessage)}`,
        );
        throw new Error(`Invalid input: ${sanitizationResult.reason}`);
      }

      const safeMessage = sanitizationResult.sanitized;
      this.logger.debug(
        `Intent analysis started (${safeMessage.length} chars)`,
      );

      const systemPrompt = `You are an expert in analyzing user queries about movies.
Your task is to analyze the user message and return a JSON response with:
- isQuestion: boolean (is this a question?)
- isMovieRelated: boolean (is it asking about movies?)
- keywords: array of keywords extracted from the message (genres, moods, plot elements, etc.)
- explicitMovie: null or movie name if user mentioned a specific movie
- mood: null or detected mood/vibe (e.g., "scary", "romantic", "action-packed")
- confidence: 0-1 confidence score for movie relevance

Important: Return ONLY valid JSON, no additional text.`;

      const response = await this.openaiService.chatCompletion(
        [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: safeMessage,
          },
        ],
        'gpt-4o-mini',
        0.3, // Lower temperature for consistency
      );

      // Parse JSON response
      let intent: IntentAnalysisResult;
      try {
        intent = JSON.parse(response.content);
        // SECURITY: Validate LLM output structure
        const validationResult = this.inputSanitizer.validateLLMOutput(
          response.content,
        );
        if (!validationResult.isValid) {
          this.logger.warn(
            `LLM output validation failed: ${validationResult.reason}`,
          );
          throw new Error(`Invalid LLM response: ${validationResult.reason}`);
        }
        this.logger.debug(`Intent analysis result: ${JSON.stringify(intent)}`);
      } catch (parseError) {
        this.logger.warn(
          `Failed to parse intent JSON, using default: ${parseError.message}`,
        );
        // Fallback: assume movie-related if message contains movie keywords
        const movieKeywords = [
          'movie',
          'film',
          'watch',
          'series',
          'show',
          'actor',
          'director',
          'genre',
          'recommend',
          'phim',
          'diễn viên',
          'thể loại',
          'gợi ý',
          'đưa',
          'lại',
          'giới thiệu',
          'cho',
        ];
        const isMovieRelated = movieKeywords.some((keyword) =>
          safeMessage.toLowerCase().includes(keyword),
        );

        intent = {
          isQuestion: true,
          isMovieRelated: isMovieRelated,
          keywords: [],
          explicitMovie: null,
          mood: null,
          confidence: isMovieRelated ? 0.6 : 0.1,
        };
      }

      return intent;
    } catch (error) {
      this.logger.error(`Intent analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 2: Find related movies using vector search
   */
  private async findRelatedMovies(
    intent: IntentAnalysisResult,
    topK: number = 5,
  ): Promise<{ movie: Partial<Movie>; similarity: number }[]> {
    try {
      if (!intent.isMovieRelated) {
        this.logger.debug('Message is not movie-related, skipping search');
        return [];
      }

      // Build search query from keywords and mood
      const searchParts: string[] = [];

      if (intent.keywords && intent.keywords.length > 0) {
        searchParts.push(intent.keywords.join(', '));
      }

      if (intent.mood) {
        searchParts.push(intent.mood);
      }

      if (intent.explicitMovie) {
        searchParts.push(intent.explicitMovie);
      }

      const searchQuery = searchParts.join('. ');

      if (!searchQuery || searchQuery.trim().length === 0) {
        this.logger.warn('No search query built from intent');
        return [];
      }

      // SECURITY: Preprocess search query for better embeddings
      const processedQuery =
        this.textPreprocessing.preprocessForEmbedding(searchQuery);
      this.logger.debug(
        `Movie search (processed query: ${processedQuery.length} chars)`,
      );

      const results = await this.movieEmbeddingService.semanticSearch(
        processedQuery,
        topK,
        0.3, // similarity threshold
      );

      this.logger.debug(`Found ${results.length} related movies`);
      console.log(results);

      return results;
    } catch (error) {
      this.logger.error(`Movie search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 3: Generate final response using LLM
   */
  private async generateFinalResponse(
    context: MovieChatContext,
  ): Promise<string> {
    try {
      let systemPrompt: string;

      const hasMovieCandidates =
        context.relatedMovies &&
        Array.isArray(context.relatedMovies) &&
        context.relatedMovies.length > 0;

      if (hasMovieCandidates) {
        const movieContext = context.relatedMovies
          .map((result, idx) => {
            const year = result.movie.release_date
              ? new Date(result.movie.release_date).getFullYear()
              : 'N/A';

            return `${idx + 1}. "${result.movie.title}" (${year}) - ${result.movie.overview || 'No description available'
              }. Rating: ${result.movie.vote_average ?? 'N/A'}/10`;
          })
          .join('\n');

        systemPrompt = `
You are a movie-focused assistant for a movie streaming website.

IMPORTANT RULES:
- Only respond about movies, watching movies, or movie-related people (actors, directors).
- Do NOT assume the system-provided movie list is always relevant.
- First, determine whether the user's message is actually related to movies or watching movies.
- If the user's message is unclear, off-topic, or unrelated, politely redirect them back to movie-related topics.
- Never answer questions outside the movie domain.

Below is a list of movies that MAY be relevant. Treat this as optional reference data, not absolute truth.

Movie candidates:
${movieContext}

Your task:
1. Check if the user's message is clearly about movies, watching movies, or movie-related information.
2. If YES:
   - Recommend ONLY movies from the list above.
   - Explain briefly why they match the user's request.
   - Keep the tone friendly, casual, and conversational.
3. If NO or NOT SURE:
   - Do NOT recommend any movie.
   - Respond politely that you can help with movie suggestions or movie information.
   - Gently guide the conversation back to movies.

Constraints:
- Never mention movies outside the provided list.
- Never fabricate information.
- Respond in Vietnamese.
- Keep the response natural and human-like, not robotic.
`;
      } else {
        systemPrompt = `
You are a movie-focused assistant for a movie streaming website.

IMPORTANT RULES:
- Only discuss movies, watching movies, or movie-related people (actors, directors).
- If the user's message is unrelated or unclear, do not attempt to answer it directly.
- Politely steer the conversation back to movie-related topics.
- Do not fabricate or guess information.

Your task:
- If the user asks about movies or actors: respond helpfully.
- If not: politely suggest that you can help with movie recommendations or movie information.

Respond in Vietnamese.
Keep the tone friendly, casual, and helpful.
`;
      }

      const response = await this.openaiService.chatCompletion(
        [
          {
            role: 'system',
            content: systemPrompt.trim(),
          },
          {
            role: 'user',
            content: context.userMessage,
          },
        ],
        'gpt-4o-mini',
        0.7,
      );

      this.logger.debug(
        `Generated response, length: ${response.content.length}`,
      );

      // SECURITY: Validate LLM response before returning
      const validationResult = this.inputSanitizer.validateLLMOutput(
        response.content,
      );

      if (!validationResult.isValid) {
        this.logger.error(
          `LLM response validation failed: ${validationResult.reason}`,
        );

        return 'Xin lỗi, mình chỉ hỗ trợ các nội dung liên quan đến phim, xem phim hoặc thông tin diễn viên. Bạn có thể hỏi lại theo chủ đề này nhé!';
      }

      return response.content;
    } catch (error) {
      this.logger.error(`Response generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main chat function: orchestrates the entire flow
   * Intent → Search → Response
   */
  async chatAboutMovie(userMessage: string): Promise<{
    userMessage: string;
    response: string;
    relatedMovies: {
      id?: string;
      title?: string;
      overview?: string;
      similarity: number;
    }[];
    intent: {
      isMovieRelated: boolean;
      keywords: string[];
      explicitMovie: string | null;
    };
  }> {
    try {
      // CRITICAL SECURITY: All user input must be treated as untrusted
      const sanitizationResult =
        this.inputSanitizer.sanitizeUserInput(userMessage);
      if (!sanitizationResult.isValid) {
        this.logger.warn(
          `Chat request rejected: ${sanitizationResult.reason} - ` +
          `Hash: ${this.inputSanitizer.hashForLogging(userMessage)}`,
        );
        throw new Error(`Invalid input: ${sanitizationResult.reason}`);
      }

      const safeUserMessage = sanitizationResult.sanitized;
      this.logger.log(`Chat started (input: ${safeUserMessage.length} chars)`);

      if (!userMessage || userMessage.trim().length === 0) {
        throw new Error('User message cannot be empty');
      }

      // Step 1: Analyze intent
      const intent = await this.analyzeIntent(safeUserMessage);

      // Step 2: Find related movies (only if movie-related)
      const relatedMovies = await this.findRelatedMovies(intent, 5);

      // Step 3: Build context
      const context: MovieChatContext = {
        userMessage: safeUserMessage,
        intent,
        relatedMovies,
      };

      // Step 4: Generate response
      const response = await this.generateFinalResponse(context);

      // Step 5: Format output
      const result = {
        userMessage: safeUserMessage,
        response,
        relatedMovies: relatedMovies.map((r) => ({
          id: r.movie.id,
          title: r.movie.title,
          overview: r.movie.overview,
          backdrops: r.movie.backdrops,
          posters: r.movie.posters,
          similarity: Math.round(r.similarity * 100) / 100,
        })),
        intent: {
          isMovieRelated: intent.isMovieRelated,
          keywords: intent.keywords,
          explicitMovie: intent.explicitMovie,
        },
      };

      this.logger.log(
        `Chat completed - Found ${relatedMovies.length} related movies`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check - verify system is ready
   */
  async healthCheck(): Promise<{
    openaiAvailable: boolean;
    embeddingsAvailable: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      // Try a simple embedding
      const testEmbedding = await this.movieEmbeddingService.semanticSearch(
        'test',
        1,
        0,
      );

      return {
        openaiAvailable: true,
        embeddingsAvailable: testEmbedding !== null,
        status: 'healthy',
      };
    } catch (error) {
      this.logger.warn(`Health check failed: ${error.message}`);
      return {
        openaiAvailable: false,
        embeddingsAvailable: false,
        status: 'unhealthy',
      };
    }
  }
}
