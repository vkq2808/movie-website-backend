import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { ConversationContext } from './conversation-context.service';
import { ConversationIntent } from './intent-classifier.service';
import { OpenAIService } from '@/modules/ai-embedding/services/openai.service';
import { InputSanitizer } from '@/modules/ai-embedding/services/input-sanitizer.service';
import { HallucinationGuardService } from '@/modules/ai-embedding/services/hallucination-guard.service';

@Injectable()
export class ResponseComposerService {
  private readonly logger = new Logger('ResponseComposerService');

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly inputSanitizer: InputSanitizer,
    private readonly hallucinationGuard: HallucinationGuardService,
  ) {}

  /**
   * Compose final response with friendly tone and storytelling
   */
  async compose(
    intent: ConversationIntent,
    movies: Movie[],
    assistantText: string,
    context: ConversationContext,
  ): Promise<string> {
    const language = context.language || 'vi';

    try {
      // If we already have a good assistant text, use it
      if (assistantText && assistantText.trim().length > 0) {
        return assistantText;
      }

      // If no movies, return generic response
      if (!movies || movies.length === 0) {
        return language === 'vi'
          ? 'Xin lỗi, mình không tìm thấy phim nào phù hợp với yêu cầu của bạn.'
          : "Sorry, I couldn't find any movies matching your request.";
      }

      // Use LLM to compose friendly response
      const composedText = await this.composeWithLLM(movies, intent, language);

      // Validate against hallucination
      const sanitizedText = await this.hallucinationGuard.sanitizeResponse(
        composedText,
        movies.map((m) => ({ title: m.title, id: m.id })),
      );

      // Check for hallucinated movie mentions
      const mentionedMovies =
        this.hallucinationGuard.extractMentionedMovies(sanitizedText);
      const hasInvalidMovies = await Promise.all(
        mentionedMovies.map((title) =>
          this.hallucinationGuard.isMovieInDatabase(title),
        ),
      );

      if (hasInvalidMovies.some((valid) => !valid)) {
        this.logger.warn(
          'LLM response contains invalid movie mentions, using fallback',
        );
        return this.generateFallbackResponse(movies, language);
      }

      return composedText;
    } catch (error) {
      this.logger.error('Response composition failed:', error);
      return this.generateFallbackResponse(movies, language);
    }
  }

  /**
   * Compose response using LLM with friendly tone
   */
  private async composeWithLLM(
    movies: Movie[],
    intent: ConversationIntent,
    language: 'vi' | 'en',
  ): Promise<string> {
    const movieContext = this.buildMovieContext(movies, language);

    const systemPrompt =
      language === 'vi'
        ? this.getVietnameseSystemPrompt()
        : this.getEnglishSystemPrompt();

    const userPrompt = `
      Intent: ${intent}
      Movies: ${movieContext}
      
      Please compose a friendly, enthusiastic response suggesting these movies.
      Keep it concise (2-3 sentences) and include a suggested follow-up question.
    `;

    const completion = await this.openaiService.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      'gpt-4o-mini',
      0.7,
    );

    return completion.content;
  }

  /**
   * Build movie context for LLM
   */
  private buildMovieContext(movies: Movie[], language: 'vi' | 'en'): string {
    return movies
      .map((movie, index) => {
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        const genres =
          movie.genres?.map((g) => g.names[0]?.name).join(', ') || 'N/A';
        const rating = movie.vote_average || 'N/A';

        return `${index + 1}. ${movie.title} (${year}) - ${genres} - Rating: ${rating}/10`;
      })
      .join('\n');
  }

  /**
   * Vietnamese system prompt for friendly responses
   */
  private getVietnameseSystemPrompt(): string {
    return `
      Bạn là một trợ lý xem phim thân thiện và nhiệt tình.
      Nhiệm vụ: Gợi ý 3 phim ngắn gọn, súc tích, vui vẻ.
      Yêu cầu:
      - Mỗi phim: 1 câu mô tả lý do gợi ý + 1 tag thể loại/năm
      - Kết thúc bằng câu hỏi gợi ý tiếp theo
      - Giọng điệu: thân thiện, chuyên nghiệp, không quá dài dòng
      - KHÔNG bịa thông tin, chỉ dùng dữ liệu phim được cung cấp
      - Trả lời bằng tiếng Việt
    `;
  }

  /**
   * English system prompt for friendly responses
   */
  private getEnglishSystemPrompt(): string {
    return `
      You are a friendly and enthusiastic movie assistant.
      Task: Suggest 3 movies concisely and enthusiastically.
      Requirements:
      - For each movie: 1-sentence reason + 1 tag (genre/year)
      - End with a suggested follow-up question
      - Tone: friendly, professional, not too verbose
      - DO NOT hallucinate, only use provided movie data
      - Respond in English
    `;
  }

  /**
   * Generate fallback response without LLM
   */
  private generateFallbackResponse(
    movies: Movie[],
    language: 'vi' | 'en',
  ): string {
    if (language === 'vi') {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `Mình gợi ý phim "${movie.title}" (${year}) - một lựa chọn tuyệt vời!`;
      } else {
        const movieList = movies.map((movie) => `"${movie.title}"`).join(', ');
        return `Mình gợi ý các phim: ${movieList}. Bạn muốn xem thông tin chi tiết về phim nào không?`;
      }
    } else {
      if (movies.length === 1) {
        const movie = movies[0];
        const year = movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : 'N/A';
        return `I recommend "${movie.title}" (${year}) - a great choice!`;
      } else {
        const movieList = movies.map((movie) => `"${movie.title}"`).join(', ');
        return `I recommend: ${movieList}. Would you like details about any of these movies?`;
      }
    }
  }

  /**
   * Generate follow-up keywords based on context
   */
  getFollowUpKeywords(
    intent: ConversationIntent,
    language: 'vi' | 'en',
    extractedEntities?: any,
  ): string[] {
    const keywords = {
      vi: {
        [ConversationIntent.GREETING]: ['gợi ý phim', 'phim mới', 'phim hay'],
        [ConversationIntent.RECOMMENDATION]: [
          'xem thêm',
          'gợi ý khác',
          'phim tương tự',
        ],
        [ConversationIntent.RANDOM]: ['ngẫu nhiên', 'gợi ý khác', 'phim mới'],
        [ConversationIntent.FOLLOW_UP]: [
          'xem thêm',
          'gợi ý khác',
          'phim tương tự',
        ],
        [ConversationIntent.COMPARISON]: [
          'so sánh khác',
          'gợi ý phim',
          'phim tương tự',
        ],
        [ConversationIntent.OFF_TOPIC]: ['gợi ý phim', 'phim hay', 'phim mới'],
      },
      en: {
        [ConversationIntent.GREETING]: [
          'suggest movies',
          'new movies',
          'good movies',
        ],
        [ConversationIntent.RECOMMENDATION]: [
          'see more',
          'other suggestions',
          'similar movies',
        ],
        [ConversationIntent.RANDOM]: [
          'random',
          'other suggestions',
          'new movies',
        ],
        [ConversationIntent.FOLLOW_UP]: [
          'see more',
          'other suggestions',
          'similar movies',
        ],
        [ConversationIntent.COMPARISON]: [
          'compare others',
          'suggest movies',
          'similar movies',
        ],
        [ConversationIntent.OFF_TOPIC]: [
          'suggest movies',
          'good movies',
          'new movies',
        ],
      },
    };

    const intentKeywords = keywords[language]?.[intent] || [];

    // Add entity-based keywords if available
    if (extractedEntities?.keywords?.length > 0) {
      return [...intentKeywords, ...extractedEntities.keywords].slice(0, 3);
    }

    return intentKeywords.slice(0, 3);
  }
}
