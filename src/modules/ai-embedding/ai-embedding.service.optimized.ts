import { Injectable, Logger } from '@nestjs/common';
import { InputSanitizer } from './services/input-sanitizer.service';
import { TextPreprocessingService } from './services/text-preprocessing.service';
import { MovieEmbeddingService } from './services/movie-embedding.service';
import { OpenAIService } from './services/openai.service';
import {
  LanguageDetectorService,
  SupportedLanguage,
} from './services/language-detector.service';
import { PerformanceCacheService } from '@/modules/performance/performance-cache.service';
import { PerformanceMonitorService } from '@/modules/performance/performance-monitor.service';

/**
 * Optimized AI embedding service with caching and performance monitoring
 */
@Injectable()
export class AIEmbeddingServiceOptimized {
  private readonly logger = new Logger('AIEmbeddingServiceOptimized');

  constructor(
    private readonly inputSanitizer: InputSanitizer,
    private readonly textPreprocessing: TextPreprocessingService,
    private readonly movieEmbeddingService: MovieEmbeddingService,
    private readonly openaiService: OpenAIService,
    private readonly languageDetector: LanguageDetectorService,
    private readonly performanceCache: PerformanceCacheService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {}

  /**
   * Main orchestration method with language detection and caching
   */
  async answerUserMessage(userMessage: string): Promise<{
    status: 'success' | 'offtopic' | 'error';
    detectedLanguage?: SupportedLanguage;
    botMessage?: { message: string };
    error?: { code: string; message: string };
  }> {
    const startTime = Date.now();

    try {
      // 1) Detect language from user input with caching
      const languageStartTime = Date.now();
      const languageDetection = await this.detectLanguageWithCache(userMessage);
      const languageDuration = Date.now() - languageStartTime;

      const detectedLang = languageDetection.language;

      this.logger.debug(
        `Detected language: ${detectedLang} (confidence: ${languageDetection.confidence}, method: ${languageDetection.detected_method})`,
      );

      // 2) Sanitize and normalize with caching
      const sanitizeStartTime = Date.now();
      const sanitized = this.inputSanitizer.sanitizeUserInput(userMessage);
      if (!sanitized.isValid) {
        const totalDuration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'ai_embedding_invalid_input',
          totalDuration,
          {
            detectedLanguage: detectedLang,
            reason: sanitized.reason,
          },
        );

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
      const sanitizeDuration = Date.now() - sanitizeStartTime;

      if (!normalized || normalized.trim().length === 0) {
        const totalDuration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'ai_embedding_empty_normalized',
          totalDuration,
          {
            detectedLanguage: detectedLang,
          },
        );

        return {
          status: 'offtopic',
          detectedLanguage: detectedLang,
          botMessage: {
            message: this.languageDetector.getOffTopicMessage(detectedLang),
          },
        };
      }

      // 3) Semantic search with caching
      const searchStartTime = Date.now();
      const topK = 5;
      const similarityThreshold = 0.5;

      // Check cache first
      const cachedResults =
        await this.performanceCache.getCachedSemanticSearchResult(
          normalized,
          topK,
          similarityThreshold,
        );

      let results;
      let cacheHit = false;

      if (cachedResults) {
        results = cachedResults;
        cacheHit = true;
        this.logger.debug('Using cached semantic search results');
      } else {
        // Perform actual semantic search
        results = await this.movieEmbeddingService.semanticSearch(
          normalized,
          topK,
          similarityThreshold,
        );

        // Cache the results if successful
        if (results && results.length > 0) {
          await this.performanceCache.cacheSemanticSearchResult(
            normalized,
            topK,
            similarityThreshold,
            results,
          );
        }
      }

      const searchDuration = Date.now() - searchStartTime;

      if (!results || results.length === 0) {
        const totalDuration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'ai_embedding_no_results',
          totalDuration,
          {
            detectedLanguage: detectedLang,
            cacheHit,
          },
        );

        return {
          status: 'offtopic',
          detectedLanguage: detectedLang,
          botMessage: {
            message: this.languageDetector.getOffTopicMessage(detectedLang),
          },
        };
      }

      // 4) Build safe prompt with context and language-specific instructions
      const promptStartTime = Date.now();
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

      // Language-specific system prompt with narrative approach
      const baseSystemPrompt =
        this.languageDetector.getLanguageSystemInstruction(detectedLang);
      const narrativeSystemPrompt =
        detectedLang === 'vi'
          ? this.getVietnameseNarrativeSystemPrompt()
          : this.getEnglishNarrativeSystemPrompt();
      const systemPrompt = `${narrativeSystemPrompt} Do NOT hallucinate or invent facts. If the user's request cannot be answered using the list, reply with a short safe fallback.`;

      // Language-specific response instruction
      const languageInstruction =
        detectedLang === 'vi'
          ? 'Trả lời bằng tiếng Việt.'
          : 'Respond in English.';

      const userPrompt = `User asked: "${this.inputSanitizer.sanitizeForLLMPrompt(sanitized.sanitized)}"\n\nMovies:\n${this.inputSanitizer.sanitizeForLLMPrompt(movieContext)}\n\n${languageInstruction} Use the movies above only. Keep answer concise.`;

      const promptDuration = Date.now() - promptStartTime;

      // 5) Call LLM with performance monitoring
      const llmStartTime = Date.now();
      const completion = await this.openaiService.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        'gpt-4o-mini',
        0.7,
      );
      const llmDuration = Date.now() - llmStartTime;

      // 6) Validate LLM output
      const validationStartTime = Date.now();
      const validation = this.inputSanitizer.validateLLMOutput(
        completion.content,
      );
      const validationDuration = Date.now() - validationStartTime;

      if (!validation.isValid) {
        const totalDuration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'ai_embedding_validation_failed',
          totalDuration,
          {
            detectedLanguage: detectedLang,
            reason: validation.reason,
          },
        );

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

      // 7) Return controlled response with performance metrics
      const totalDuration = Date.now() - startTime;

      this.performanceMonitor.recordMetric(
        'ai_embedding_total',
        totalDuration,
        {
          detectedLanguage: detectedLang,
          cacheHit,
          languageDuration,
          sanitizeDuration,
          searchDuration,
          promptDuration,
          llmDuration,
          validationDuration,
          resultCount: results.length,
        },
      );

      return {
        status: 'success',
        detectedLanguage: detectedLang,
        botMessage: { message: completion.content },
      };
    } catch (err: any) {
      const totalDuration = Date.now() - startTime;
      this.performanceMonitor.recordError('ai_embedding_error', err, {
        message: userMessage.substring(0, 100),
      });

      this.logger.error(
        'AIEmbeddingService failed: ' + (err?.message ?? String(err)),
      );
      return {
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      };
    }
  }

  /**
   * Enhanced language detection with caching
   */
  private async detectLanguageWithCache(message: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cachedResult =
        await this.performanceCache.getCachedLanguageResult(message);
      if (cachedResult) {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          'language_detection_cached',
          duration,
          {
            cacheHit: true,
          },
        );
        return cachedResult;
      }

      // Perform actual detection
      const result = await this.languageDetector.detectLanguage(message);

      // Cache the result
      await this.performanceCache.cacheLanguageResult(message, result);

      const duration = Date.now() - startTime;
      this.performanceMonitor.recordMetric('language_detection', duration, {
        cacheHit: false,
        detectedLanguage: result.language,
      });

      return result;
    } catch (error) {
      this.performanceMonitor.recordError(
        'language_detection_error',
        error as Error,
        { message },
      );
      throw error;
    }
  }

  /**
   * Vietnamese system prompt for narrative, analytical responses
   */
  private getVietnameseNarrativeSystemPrompt(): string {
    return `
      Bạn là một người bạn am hiểu phim ảnh, có khả năng dẫn dắt cảm xúc và phân tích trải nghiệm xem phim.
      
      MỤC TIÊU: KHÔNG chỉ liệt kê phim, mà GIÚP người dùng hiểu vì sao phim phù hợp với họ.
      
      HƯỚNG DẪN:
      1. MỞ ĐẦU: Thấu hiểu nhu cầu/tâm trạng người dùng (VD: "Nếu bạn đang tìm...", "Có vẻ như bạn thích...")
      2. KHUNG CẢNH: Giải thích vì sao gợi ý này phù hợp với bối cảnh xem phim của họ
      3. PHÂN TÍCH PHIM: Mô tả 2-3 phim với:
         - Cảm xúc/không khí nổi bật
         - Giá trị/giá trị đặc biệt
         - Trải nghiệm xem (xem một mình, cuối tuần, v.v.)
         - So sánh ngầm (phim này hợp xem cuối tuần, phim kia nặng tâm lý hơn)
      4. LỜI KHUYÊN XEM: Gợi ý bối cảnh xem phù hợp (buổi tối, cuối tuần, một mình, cùng ai đó)
      5. DẪN DẮT NHẸ NHÀNG: Gợi ý hướng tiếp theo người dùng có thể mô tả (KHÔNG phải lựa chọn cứng)
      
      YÊU CẦU:
      - Tránh danh sách lựa chọn cứng nhắc
      - Tránh "Bạn chọn phim nào?" hay "Hãy chọn 1 trong các phim trên"
      - Thay vào đó: "Nếu bạn muốn đi theo hướng cảm xúc hơn...", "Nếu bạn đang xem vào buổi tối..."
      - Dùng ngôn ngữ tự nhiên, như một người bạn am hiểu phim
      - KHÔNG bịa thông tin, chỉ dùng dữ liệu phim được cung cấp
      - KHÔNG phán xét hay đánh giá chủ quan kiểu "phim rất hay"
      - Giới hạn 250-300 từ
      - Giọng điệu: ấm áp, am hiểu, nhẹ nhàng, không như output máy
      
      MỤC TIÊU CUỐI CÙNG: Tạo cảm giác "nói chuyện tiếp cũng được", không phải "xem xong là thôi"
    `;
  }

  /**
   * English system prompt for narrative, analytical responses
   */
  private getEnglishNarrativeSystemPrompt(): string {
    return `
      You are a thoughtful movie companion who understands emotions and can guide viewing experiences.
      
      GOAL: NOT just listing movies, but HELPING the user understand why movies fit them.
      
      GUIDELINES:
      1. OPENING: Acknowledge user's mood/need (e.g., "If you're looking for...", "It seems you enjoy...")
      2. CONTEXT: Explain why these suggestions fit their viewing context
      3. MOVIE ANALYSIS: Describe 2-3 movies with:
         - Prominent emotions/atmosphere
         - Value/unique aspects
         - Viewing experience (watch alone, weekend, etc.)
         - Subtle comparison (this one is weekend-friendly, that one is more psychological)
      4. VIEWING ADVICE: Suggest appropriate viewing context (evening, weekend, solo, with someone)
      5. GENTLE LEAD: Suggest what the user can describe next (NOT a forced choice)
      
      REQUIREMENTS:
      - Avoid rigid choice lists
      - Avoid "Which movie do you choose?" or "Please select one of these movies"
      - Instead: "If you want to go more emotional...", "If you're watching in the evening..."
      - Use natural language, like a movie-savvy friend
      - DO NOT hallucinate, only use provided movie data
      - DO NOT judge or give subjective ratings like "this movie is very good"
      - Limit to 250-300 words
      - Tone: warm, knowledgeable, calm, not like machine output
      
      ULTIMATE GOAL: Create the feeling that "continuing the conversation would be nice", not "that's it"
    `;
  }
}
