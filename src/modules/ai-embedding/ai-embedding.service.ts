import { Injectable, Logger } from '@nestjs/common';
import { InputSanitizer } from './services/input-sanitizer.service';
import { TextPreprocessingService } from './services/text-preprocessing.service';
import { MovieEmbeddingService } from './services/movie-embedding.service';
import { OpenAIService } from './services/openai.service';
import {
  LanguageDetectorService,
  SupportedLanguage,
} from './services/language-detector.service';

@Injectable()
export class AIEmbeddingService {
  private readonly logger = new Logger('AIEmbeddingService');

  constructor(
    private readonly inputSanitizer: InputSanitizer,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly openaiService: OpenAIService,
    private readonly languageDetector: LanguageDetectorService,
  ) {}

  /**
   * Main orchestration method with language detection
   * - detects user input language (VI/EN)
   * - sanitizes + normalizes input
   * - runs semantic search
   * - if no results -> return off-topic fallback in detected language
   * - otherwise builds language-aware prompt and calls LLM
   * - ensures response matches input language
   */
  async answerUserMessage(userMessage: string): Promise<{
    status: 'success' | 'offtopic' | 'error';
    detectedLanguage?: SupportedLanguage;
    botMessage?: { message: string };
    error?: { code: string; message: string };
  }> {
    try {
      // 1) Detect language from user input
      const languageDetection =
        await this.languageDetector.detectLanguage(userMessage);
      const detectedLang = languageDetection.language;

      this.logger.debug(
        `Detected language: ${detectedLang} (confidence: ${languageDetection.confidence}, method: ${languageDetection.detected_method})`,
      );

      // 2) Sanitize and normalize
      const sanitized = this.inputSanitizer.sanitizeUserInput(userMessage);
      if (!sanitized.isValid) {
        return {
          status: 'error',
          detectedLanguage: detectedLang,
          error: {
            code: 'INVALID_INPUT',
            message: sanitized.reason || 'Invalid input',
          },
        };
      }

      const normalized = this.textPreprocessing.preprocessForEmbedding(
        sanitized.sanitized,
      );
      if (!normalized || normalized.trim().length === 0) {
        return {
          status: 'offtopic',
          detectedLanguage: detectedLang,
          botMessage: {
            message: this.languageDetector.getOffTopicMessage(detectedLang),
          },
        };
      }

      // 3) Semantic search with language-aware query
      const topK = 5;
      const similarityThreshold = 0.5; // business threshold
      const results = await this.movieEmbeddingService.semanticSearch(
        normalized,
        topK,
        similarityThreshold,
      );

      if (!results || results.length === 0) {
        return {
          status: 'offtopic',
          detectedLanguage: detectedLang,
          botMessage: {
            message: this.languageDetector.getOffTopicMessage(detectedLang),
          },
        };
      }

      // 4) Build safe prompt with context and language-specific instructions
      const movieContext = results
        .map((r, idx) => {
          const movie = r.movie;
          const year = movie.release_date
            ? new Date(movie.release_date).getFullYear()
            : 'N/A';
          const overview = movie.overview
            ? movie.overview
            : 'No description available';
          return `${idx + 1}. ${movie.title} (${year}) - ${overview} Rating: ${movie.vote_average ?? 'N/A'}/10`;
        })
        .join('\n');

      // Language-specific system prompt
      const baseSystemPrompt =
        this.languageDetector.getLanguageSystemInstruction(detectedLang);
      const systemPrompt = `${baseSystemPrompt} Do NOT hallucinate or invent facts. If the user's request cannot be answered using the list, reply with a short safe fallback.`;

      // Language-specific response instruction
      const languageInstruction =
        detectedLang === 'vi'
          ? 'Trả lời bằng tiếng Việt.'
          : 'Respond in English.';

      const userPrompt = `User asked: "${this.inputSanitizer.sanitizeForLLMPrompt(sanitized.sanitized)}"\n\nMovies:\n${this.inputSanitizer.sanitizeForLLMPrompt(movieContext)}\n\n${languageInstruction} Use the movies above only. Keep answer concise.`;

      // 5) Call LLM with language awareness
      const completion = await this.openaiService.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        'gpt-4o-mini',
        0.7,
      );

      // 6) Validate LLM output
      const validation = this.inputSanitizer.validateLLMOutput(
        completion.content,
      );
      if (!validation.isValid) {
        this.logger.warn(
          'LLM output failed validation: ' + (validation.reason ?? 'unknown'),
        );
        return {
          status: 'error',
          detectedLanguage: detectedLang,
          error: {
            code: 'LLM_INVALID_OUTPUT',
            message: 'LLM returned invalid response',
          },
        };
      }

      // 7) Return controlled response with detected language info
      return {
        status: 'success',
        detectedLanguage: detectedLang,
        botMessage: { message: completion.content },
      };
    } catch (err: any) {
      this.logger.error(
        'AIEmbeddingService failed: ' + (err?.message ?? String(err)),
      );
      return {
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      };
    }
  }
}
