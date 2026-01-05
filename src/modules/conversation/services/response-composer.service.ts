import { Injectable, Logger } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { ConversationContext } from './conversation-context.service';
import { ConversationIntent } from './intent-classifier.service';
import { OpenAIService } from '@/modules/ai-embedding/services/openai.service';
import { InputSanitizer } from '@/modules/ai-embedding/services/input-sanitizer.service';
import { HallucinationGuardService } from '@/modules/ai-embedding/services/hallucination-guard.service';
import { MovieCast } from '@/modules/movie/entities/movie-cast.entity';
import { MovieCrew } from '@/modules/movie/entities/movie-crew.entity';

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
   * Compose response using LLM with narrative, analytical approach
   */
  private async composeWithLLM(
    movies: Movie[],
    intent: ConversationIntent,
    language: 'vi' | 'en',
  ): Promise<string> {
    const movieContext = this.buildMovieContext(movies, language);

    const systemPrompt =
      language === 'vi'
        ? this.getVietnameseNarrativeSystemPrompt()
        : this.getEnglishNarrativeSystemPrompt();

    const userPrompt = `
      Intent: ${intent}
      Movies: ${movieContext}
      
      Please compose a response following this structure:
      1. Acknowledgement/Empathy - understand user's mood/need
      2. Contextual Framing - explain why these suggestions fit
      3. Movie Deep Explanation - describe 2-3 movies with feeling/atmosphere/value
      4. Soft Comparison/Viewing Advice - subtle comparison, viewing context
      5. Gentle Follow-up - suggest what user can describe next (NOT forced choice)
      
      Keep it conversational, avoid bullet lists, and focus on experience.
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
        const overview = movie.overview
          ? movie.overview.substring(0, 200) + '...'
          : 'No overview available';

        // Get top cast members
        const topCast = movie.cast
          ? movie.cast
              .filter((c: any) => c.person?.name && c.character)
              .slice(0, 3)
              .map((c: any) => `${c.person.name} as ${c.character}`)
              .join(', ')
          : 'No cast information';

        // Get director
        const director = movie.crew
          ? movie.crew.find((c: any) => c.job === 'Director')?.person?.name ||
            'Unknown'
          : 'Unknown';

        return `${index + 1}. ${movie.title} (${year})
- Genres: ${genres}
- Rating: ${rating}/10
- Director: ${director}
- Overview: ${overview}
- Top Cast: ${topCast}`;
      })
      .join('\n\n');
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

  /**
   * Vietnamese system prompt for friendly responses (legacy)
   */
  private getVietnameseSystemPrompt(): string {
    return `
      Bạn là một trợ lý xem phim thân thiện và nhiệt tình.
      Nhiệm vụ: Gợi ý 3 phim ngắn gọn, súc tích, vui vẻ.
      Yêu cầu:
      - Mỗi phim: 1-2 câu mô tả lý do gợi ý, có thể bao gồm: cốt truyện hấp dẫn, diễn viên nổi bật, đạo diễn tài năng, giải thưởng, hoặc điểm đặc biệt
      - Kết hợp thông tin: thể loại, năm, diễn viên chính, đạo diễn, điểm IMDb
      - Kết thúc bằng câu hỏi gợi ý tiếp theo
      - Giọng điệu: thân thiện, chuyên nghiệp, hấp dẫn
      - KHÔNG bịa thông tin, chỉ dùng dữ liệu phim được cung cấp
      - Trả lời bằng tiếng Việt
      - Ưu tiên gợi ý những thông tin nổi bật và hấp dẫn nhất của mỗi phim
    `;
  }

  /**
   * English system prompt for friendly responses (legacy)
   */
  private getEnglishSystemPrompt(): string {
    return `
      You are a friendly and enthusiastic movie assistant.
      Task: Suggest 3 movies concisely and enthusiastically.
      Requirements:
      - For each movie: 1-2 sentences reason + include: plot highlights, notable actors, director, awards, or unique features
      - Combine information: genre, year, main cast, director, IMDb rating
      - End with a suggested follow-up question
      - Tone: friendly, professional, engaging
      - DO NOT hallucinate, only use provided movie data
      - Respond in English
      - Prioritize the most exciting and notable aspects of each movie
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
        const genres =
          movie.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const rating = movie.vote_average || '';
        const director =
          movie.crew?.find((c: any) => c.job === 'Director')?.person?.name ||
          '';

        let response = `Mình gợi ý phim "${movie.title}" (${year})`;
        if (genres) response += ` - ${genres}`;
        if (rating) response += ` - Đánh giá: ${rating}/10`;
        if (director) response += ` - Đạo diễn: ${director}`;
        response += ' - một lựa chọn tuyệt vời!';
        return response;
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
        const genres =
          movie.genres?.map((g) => g.names[0]?.name).join(', ') || '';
        const rating = movie.vote_average || '';
        const director =
          movie.crew?.find((c: any) => c.job === 'Director')?.person?.name ||
          '';

        let response = `I recommend "${movie.title}" (${year})`;
        if (genres) response += ` - ${genres}`;
        if (rating) response += ` - Rating: ${rating}/10`;
        if (director) response += ` - Director: ${director}`;
        response += ' - a great choice!';
        return response;
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
