import { Injectable, Logger } from '@nestjs/common';
import { InputSanitizer } from './services/input-sanitizer.service';
import { TextPreprocessingService } from './services/text-preprocessing.service';
import { MovieEmbeddingService } from './services/movie-embedding.service';
import { OpenAIService } from './services/openai.service';

@Injectable()
export class AIEmbeddingService {
  private readonly logger = new Logger('AIEmbeddingService');

  constructor(
    private readonly inputSanitizer: InputSanitizer,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly openaiService: OpenAIService,
  ) { }

  /**
   * Main orchestration method.
   * - sanitizes + normalizes input
   * - runs semantic search
   * - if no results -> return off-topic fallback
   * - otherwise build safe prompt and call LLM
   */
  async answerUserMessage(userMessage: string): Promise<{
    status: 'success' | 'offtopic' | 'error';
    botMessage?: { message: string };
    error?: { code: string; message: string };
  }> {
    try {
      // 1) Sanitize and normalize
      const sanitized = this.inputSanitizer.sanitizeUserInput(userMessage);
      if (!sanitized.isValid) {
        return {
          status: 'error',
          error: { code: 'INVALID_INPUT', message: sanitized.reason || 'Invalid input' },
        };
      }

      const normalized = this.textPreprocessing.preprocessForEmbedding(sanitized.sanitized);
      if (!normalized || normalized.trim().length === 0) {
        return {
          status: 'offtopic',
          botMessage: { message: 'Hiện tại tôi chỉ hỗ trợ thông tin về phim trong hệ thống. Bạn có thể hỏi về một bộ phim cụ thể không?' },
        };
      }

      // 2) Semantic search
      const topK = 5;
      const similarityThreshold = 0.5; // business threshold
      const results = await this.movieEmbeddingService.semanticSearch(normalized, topK, similarityThreshold);

      if (!results || results.length === 0) {
        return {
          status: 'offtopic',
          botMessage: { message: 'Hiện tại tôi chỉ hỗ trợ thông tin về phim trong hệ thống. Bạn có thể hỏi về một bộ phim cụ thể không?' },
        };
      }

      // 3) Build safe prompt with context
      const movieContext = results
        .map((r, idx) => {
          const movie = r.movie;
          const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
          const overview = movie.overview ? movie.overview : 'No description available';
          return `${idx + 1}. ${movie.title} (${year}) - ${overview} Rating: ${movie.vote_average ?? 'N/A'}/10`;
        })
        .join('\n');

      const systemPrompt = `You are a movie recommendation assistant. Use ONLY the movie list provided below to answer the user's request. Do NOT hallucinate or invent facts. If the user's request cannot be answered using the list, reply with a short safe fallback in Vietnamese saying you can only support movies in the system.`;

      const userPrompt = `User asked: "${this.inputSanitizer.sanitizeForLLMPrompt(sanitized.sanitized)}"\n\nMovies:\n${this.inputSanitizer.sanitizeForLLMPrompt(movieContext)}\n\nRespond in Vietnamese. Use the movies above only. Keep answer concise.`;

      // 4) Call LLM
      const completion = await this.openaiService.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 'gpt-4-turbo', 0.7);

      // 5) Validate LLM output
      const validation = this.inputSanitizer.validateLLMOutput(completion.content);
      if (!validation.isValid) {
        this.logger.warn('LLM output failed validation: ' + (validation.reason ?? 'unknown'));
        return {
          status: 'error',
          error: { code: 'LLM_INVALID_OUTPUT', message: 'LLM returned invalid response' },
        };
      }

      // 6) Return controlled response
      return {
        status: 'success',
        botMessage: { message: completion.content },
      };
    } catch (err: any) {
      this.logger.error('AIEmbeddingService failed: ' + (err?.message ?? String(err)));
      return {
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      };
    }
  }
}
