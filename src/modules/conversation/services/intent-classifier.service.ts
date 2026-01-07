import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from '@/modules/ai-embedding/services/openai.service';
import { LanguageDetectorService } from '@/modules/ai-embedding/services/language-detector.service';
import { SupportedLanguage } from '@/modules/ai-embedding/services/language-detector.service';

export enum ConversationIntent {
  GREETING = 'greeting',
  FOLLOW_UP = 'follow_up',
  RECOMMENDATION = 'recommendation',
  RANDOM = 'random',
  COMPARISON = 'comparison',
  OFF_TOPIC = 'off_topic',
  FAREWELL = 'farewell',
}

export interface IntentResult {
  intent: ConversationIntent;
  confidence: number;
  language?: 'vi' | 'en'; // Detected language from analysis
  extractedEntities?: {
    movieNames?: string[];
    keywords?: string[];
  };
}

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger('IntentClassifierService');

  // Pre-compiled regex patterns for performance
  private readonly VIETNAMESE_PATTERNS = {
    greeting: [
      // Basic greetings
      /xin\s+chào|chào\s+bạn|hello|hi|chào/gi,
      /xin\s+chào|chào\s+mừng|chào\s+các\s+bạn/gi,
      // Question-based greetings
      /có\s+thể\s+giúp|có\s+thể\s+hỏi|có\s+thể\s+gợi\s+ý|có\s+thể\s+trợ\s+giúp/gi,
      /bạn\s+có\s+thể|bạn\s+có\s+khả\s+năng|bạn\s+có\s+thể\s+giúp/gi,
      /mình\s+có\s+thể|tôi\s+có\s+thể|chúng\s+tôi\s+có\s+thể/gi,
      // Polite greetings
      /xin\s+phép|xin\s+hỏi|cho\s+hỏi|cho\s+mình\s+hỏi/gi,
      /thưa\s+các\s+bạn|thưa\s+quý\s+vị|kính\s+thưa/gi,
    ],
    farewell: [
      // Basic farewells
      /tạm\s+biệt|goodbye|bye|cảm\s+ơn|thank\s+you|ok|oke/gi,
      /tạm\s+biet|tạm\s+biêt|tạm\s+bịt/gi,
      // Thanks and appreciation
      /cảm\s+ơn|cảm\s+ơn\s+bạn|cảm\s+ơn\s+rất\s+nhiều|cảm\s+ơn\s+nhiều/gi,
      /xin\s+cảm\s+ơn|trân\s+trọng\s+cảm\s+ơn|kính\s+cảm\s+ơn/gi,
      // Ending phrases
      /không\s+cần|không\s+muốn|đủ\s+rồi|đủ\s+rùi|đủ\s+rồi\s+rùi/gi,
      /không\s+cần\s+nữa|không\s+muốn\s+nữa|đủ\s+rồi\s+nhé/gi,
      /tạm\s+biệt|tạm\s+biet|tạm\s+biêt|tạm\s+bịt/gi,
      /hẹn\s+gặp\s+lại|hẹn\s+gặp\s+lại\s+sau|gặp\s+lại\s+sau/gi,
    ],
    followUp: [
      // Continuation requests
      /còn\s+gì|khác|tiếp|thêm|và|hoặc/gi,
      /còn\s+gì\s+nữa|còn\s+gì\s+khác|còn\s+gì\s+khác\s+nữa/gi,
      /có\s+gì|có\s+gì\s+đó|có\s+gì\s+khác/gi,
      /có\s+gì\s+khác|có\s+gì\s+khác\s+nữa|có\s+gì\s+mới/gi,
      // "Suggest again" and "suggest another" patterns
      /gợi\s+ý\s+lại|gợi\s+ý\s+thêm|gợi\s+ý\s+khác|gợi\s+ý\s+mới/gi,
      /gợi\s+ý\s+một\s+cái\s+khác|gợi\s+ý\s+một\s+thứ\s+khác/gi,
      /gợi\s+ý\s+tiếp|gợi\s+ý\s+tiếp\s+theo|gợi\s+ý\s+thêm\s+nữa/gi,
      // Similar requests
      /giống\s+phim|tương\s+tự|như\s+phim|giống\s+với/gi,
      /giống\s+như|tương\s+tự\s+với|giống\s+hệt|giống\s+hệt\s+với/gi,
      // Additional requests
      /có\s+gì|có\s+khác|có\s+gợi\s+ý/gi,
      /có\s+gợi\s+ý|có\s+gợi\s+ý\s+khác|có\s+gợi\s+ý\s+mới/gi,
      /gợi\s+ý\s+thêm|gợi\s+ý\s+khác|gợi\s+ý\s+mới/gi,
    ],
    recommendation: [
      // Direct recommendation requests
      /gợi\s+ý|recommend|recommendation|gợi\s+ý\s+phim|gợi\s+ý\s+một\s+phim/gi,
      /gợi\s+ý\s+cho\s+tôi|gợi\s+ý\s+cho\s+mình|gợi\s+ý\s+cho\s+tớ/gi,
      /gợi\s+ý\s+giúp|gợi\s+ý\s+giùm|gợi\s+ý\s+giúp\s+tôi/gi,
      // "Suggest again" and "suggest another" patterns
      /gợi\s+ý\s+lại|gợi\s+ý\s+thêm|gợi\s+ý\s+khác|gợi\s+ý\s+mới/gi,
      /gợi\s+ý\s+một\s+cái\s+khác|gợi\s+ý\s+một\s+thứ\s+khác/gi,
      /recommend\s+again|suggest\s+again|recommend\s+another|suggest\s+another/gi,
      /recommend\s+me\s+another|suggest\s+me\s+another/gi,
      // Question-based requests
      /có\s+gợi\s+ý|có\s+phim|có\s+một\s+phim/gi,
      /có\s+phim\s+nào|có\s+phim\s+gì|có\s+phim\s+gì\s+không/gi,
      /có\s+gợi\s+ý|có\s+gợi\s+ý\s+gì|có\s+gợi\s+ý\s+gì\s+không/gi,
      // Desire-based requests
      /tôi\s+muốn|tôi\s+cần|tôi\s+đang\s+tìm/gi,
      /mình\s+muốn|mình\s+cần|mình\s+đang\s+tìm/gi,
      /tớ\s+muốn|tớ\s+cần|tớ\s+đang\s+tìm/gi,
      /chúng\s+tôi\s+muốn|chúng\s+tôi\s+cần|chúng\s+tôi\s+đang\s+tìm/gi,
      // Search requests
      /tìm\s+phim|tìm\s+một\s+phim|tìm\s+gì/gi,
      /tìm\s+phim\s+nào|tìm\s+phim\s+gì|tìm\s+phim\s+gì\s+không/gi,
      /tìm\s+giúp|tìm\s+giùm|tìm\s+giúp\s+tôi/gi,
      // Help requests
      /giúp\s+tôi|giúp\s+mình|giúp\s+tớ|giúp\s+chúng\s+tôi/gi,
      /giúp\s+tôi\s+tìm|giúp\s+mình\s+tìm|giúp\s+tớ\s+tìm/gi,
      /giúp\s+tôi\s+gợi\s+ý|giúp\s+mình\s+gợi\s+ý|giúp\s+tớ\s+gợi\s+ý/gi,
    ],
    random: [
      // Random requests
      /ngẫu\s+nhiên|random|bất\s+kỳ|gì\s+cũng\s+được/gi,
      /ngẫu\s+nhiên\s+một|random\s+một|bất\s+kỳ\s+một/gi,
      // Anything requests
      /có\s+gì|có\s+gì\s+đó|có\s+gì\s+khác/gi,
      /có\s+gì\s+cũng\s+được|có\s+gì\s+cũng\s+được\s+nhé/gi,
      /gì\s+cũng\s+được|gì\s+cũng\s+được\s+nhé/gi,
      // No preference
      /không\s+biết|không\s+biết\s+gì|không\s+biết\s+chọn\s+gì/gi,
      /không\s+biết\s+chọn|không\s+biết\s+chọn\s+phim\s+nào/gi,
      /không\s+có\s+ý\s+tưởng|không\s+có\s+suy\s+nghĩ|không\s+có\s+ý\s+định/gi,
    ],
    comparison: [
      // Compare requests
      /so\s+sánh|compare|so\s+sánh\s+giữa|giữa\s+.*\s+và/gi,
      /so\s+sánh\s+với|so\s+sánh\s+vs|so\s+sánh\s+với\s+nhau/gi,
      // Which is better
      /cái\s+nào|nào\s+tốt|nào\s+hơn/gi,
      /cái\s+nào\s+tốt|cái\s+nào\s+hơn|cái\s+nào\s+hay/gi,
      /nào\s+tốt\s+hơn|nào\s+hơn\s+tốt|nào\s+hay\s+hơn/gi,
      // Difference requests
      /khác\s+nhau|khác\s+biệt|so\s+sánh\s+sự\s+khác\s+nhau/gi,
      /giống\s+nhau|giống\s+nhau\s+như\s+thế\s+nào/gi,
    ],
    genre: [
      // Genre requests
      /phim\s+hành\s+động|phim\s+tình\s+cảm|phim\s+hài|phim\s+kinh\s+dị/gi,
      /phim\s+viễn\s+tưởng|phim\s+phiêu\s+lưu|phim\s+tâm\s+lý/gi,
      /phim\s+chiến\s+tranh|phim\s+lịch\s+sử|phim\s+tài\s+liệu/gi,
      /phim\s+hoạt\s+hình|phim\s+gia\s+đình|phim\s+tình\s+yêu/gi,
      // Genre keywords
      /hành\s+động|tình\s+cảm|hài|kinh\s+dị|viễn\s+tưởng|phiêu\s+lưu|tâm\s+lý/gi,
      /chiến\s+tranh|lịch\s+sử|tài\s+liệu|hoạt\s+hình|gia\s+đình|tình\s+yêu/gi,
    ],
    actor: [
      // Actor requests
      /phim\s+của|phim\s+do\s+.*\s+diễn|phim\s+do\s+.*\s+chủ\s+diễn/gi,
      /phim\s+có\s+.*\s+diễn|phim\s+có\s+.*\s+chủ\s+diễn/gi,
      /diễn\s+viên|diễn\s+viên\s+chính|diễn\s+viên\s+nổi\s+tiếng/gi,
      // Actor keywords
      /Tom\s+Hanks|Leonardo\s+DiCaprio|Brad\s+Pitt|Johnny\s+Depp/gi,
      /Angelina\s+Jolie|Scarlett\s+Johansson|Natalie\s+Portman/gi,
      /Vera\s+Farmiga|Patrick\s+Wilson|James\s+Wan/gi,
    ],
    year: [
      // Year requests
      /phim\s+năm|phim\s+từ\s+năm|phim\s+ra\s+mắt\s+năm/gi,
      /phim\s+cũ|phim\s+mới|phim\s+gần\s+đây|phim\s+cổ\s+điển/gi,
      // Year keywords
      /năm\s+2023|năm\s+2022|năm\s+2021|năm\s+2020|năm\s+2019/gi,
      /năm\s+2018|năm\s+2017|năm\s+2016|năm\s+2015|năm\s+2014/gi,
      /năm\s+2013|năm\s+2012|năm\s+2011|năm\s+2010|năm\s+2009/gi,
    ],
  };

  private readonly ENGLISH_PATTERNS = {
    greeting: [
      // Basic greetings
      /hello|hi|hey|greetings/gi,
      /hello\s+there|hi\s+there|hey\s+there/gi,
      // Question-based greetings
      /can\s+you\s+help|can\s+you\s+recommend|can\s+you\s+suggest|can\s+you\s+assist/gi,
      /are\s+you\s+able|are\s+you\s+capable|are\s+you\s+ready/gi,
      /could\s+you\s+help|would\s+you\s+help|will\s+you\s+help/gi,
      // Polite greetings
      /excuse\s+me|pardon\s+me|sorry\s+to\s+bother/gi,
      /good\s+morning|good\s+afternoon|good\s+evening/gi,
    ],
    farewell: [
      // Basic farewells
      /goodbye|bye|thank\s+you|thanks|ok|oke/gi,
      /good\s+bye|bye\s+bye|see\s+you|see\s+ya/gi,
      // Thanks and appreciation
      /thank\s+you|thanks|thank\s+you\s+very\s+much|thank\s+you\s+so\s+much/gi,
      /thanks\s+a\s+lot|thank\s+you\s+so\s+much|thank\s+you\s+very\s+much/gi,
      /i\s+appreciate|we\s+appreciate|thank\s+you\s+for/gi,
      // Ending phrases
      /no\s+thanks|no\s+need|enough|done|finished/gi,
      /that's\s+it|that's\s+all|i'm\s+done|we're\s+done/gi,
      /good\s+night|have\s+a\s+good|take\s+care/gi,
      /see\s+you\s+later|see\s+you\s+soon|talk\s+to\s+you\s+later/gi,
    ],
    followUp: [
      // Continuation requests
      /what\s+else|anything\s+else|more|another|also|or/gi,
      /what\s+else\s+is\s+there|anything\s+else\s+available/gi,
      /got\s+anything|got\s+something|got\s+any/gi,
      // "Suggest again" and "suggest another" patterns
      /recommend\s+again|suggest\s+again|recommend\s+another|suggest\s+another/gi,
      /recommend\s+me\s+another|suggest\s+me\s+another/gi,
      /give\s+me\s+another|give\s+me\s+more|show\s+me\s+another/gi,
      /what\s+else|anything\s+else|something\s+else/gi,
      /different\s+one|other\s+options|more\s+options/gi,
      /one\s+more|another\s+one|more\s+please/gi,
      // Similar requests
      /similar\s+to|like\s+the\s+movie|like\s+that|similar\s+movies/gi,
      /similar\s+to\s+that|like\s+this\s+one|like\s+the\s+above/gi,
      // Additional requests
      /any\s+other|any\s+different|any\s+suggestions/gi,
      /any\s+other\s+options|any\s+different\s+options/gi,
      /more\s+like|more\s+like\s+this|more\s+like\s+that/gi,
    ],
    recommendation: [
      // Direct recommendation requests
      /recommend|recommendation|suggest|suggest\s+me|suggest\s+a\s+movie/gi,
      /recommend\s+me|recommend\s+me\s+a|recommend\s+me\s+some/gi,
      /suggest\s+me|suggest\s+me\s+a|suggest\s+me\s+some/gi,
      // "Suggest again" and "suggest another" patterns
      /recommend\s+again|suggest\s+again|recommend\s+another|suggest\s+another/gi,
      /recommend\s+me\s+another|suggest\s+me\s+another/gi,
      /give\s+me\s+another|give\s+me\s+more|show\s+me\s+another/gi,
      /what\s+else|anything\s+else|something\s+else/gi,
      /different\s+one|other\s+options|more\s+options/gi,
      // Question-based requests
      /can\s+you\s+recommend|can\s+you\s+suggest|do\s+you\s+recommend/gi,
      /could\s+you\s+recommend|would\s+you\s+recommend|will\s+you\s+recommend/gi,
      /what\s+do\s+you\s+recommend|what\s+would\s+you\s+recommend/gi,
      // Desire-based requests
      /i\s+want|i\s+need|i\s+am\s+looking\s+for/gi,
      /i\s+want\s+to|I\s+need\s+to|i\s+am\s+looking\s+for/gi,
      /we\s+want|we\s+need|we\s+are\s+looking\s+for/gi,
      // Search requests
      /looking\s+for|find\s+a\s+movie|find\s+something/gi,
      /looking\s+for\s+a|looking\s+for\s+some|looking\s+for\s+any/gi,
      /find\s+me|find\s+me\s+a|find\s+me\s+some/gi,
      // Help requests
      /help\s+me|help\s+us|help\s+me\s+find|help\s+us\s+find/gi,
      /help\s+me\s+choose|help\s+us\s+choose|help\s+me\s+decide/gi,
    ],
    random: [
      // Random requests
      /random|anything|whatever|any\s+movie/gi,
      /random\s+movie|random\s+selection|random\s+pick/gi,
      // Anything requests
      /got\s+anything|got\s+something|got\s+any/gi,
      /have\s+anything|have\s+something|have\s+any/gi,
      // No preference
      /don't\s+know|don't\s+know\s+what|don't\s+know\s+which/gi,
      /no\s+idea|no\s+preference|don't\s+care/gi,
      /anything\s+works|anything\s+is\s+fine|whatever\s+you\s+think/gi,
    ],
    comparison: [
      // Compare requests
      /compare|compare\s+between|between\s+.*\s+and/gi,
      /compare\s+to|compare\s+with|compare\s+against/gi,
      // Which is better
      /which\s+one|which\s+is|which\s+better/gi,
      /which\s+one\s+is|which\s+is\s+better|which\s+is\s+best/gi,
      /which\s+movie|which\s+film|which\s+one\s+should/gi,
      // Difference requests
      /different|difference|differences|compare\s+the\s+differences/gi,
      /same|similar|similarities|compare\s+the\s+similarities/gi,
    ],
    genre: [
      // Genre requests
      /action\s+movie|romance\s+movie|comedy\s+movie|horror\s+movie/gi,
      /sci-fi\s+movie|adventure\s+movie|drama\s+movie|thriller\s+movie/gi,
      /action\s+film|romance\s+film|comedy\s+film|horror\s+film/gi,
      // Genre keywords
      /action|romance|comedy|horror|sci-fi|adventure|drama|thriller/gi,
      /animation|family|documentary|biography|history|war/gi,
    ],
    actor: [
      // Actor requests
      /movie\s+with|film\s+with|movie\s+starring|film\s+starring/gi,
      /movie\s+by|film\s+by|movie\s+directed\s+by|film\s+directed\s+by/gi,
      /actor|actress|cast|cast\s+member|star\s+cast/gi,
      // Actor keywords
      /Tom\s+Hanks|Leonardo\s+DiCaprio|Brad\s+Pitt|Johnny\s+Depp/gi,
      /Angelina\s+Jolie|Scarlett\s+Johansson|Natalie\s+Portman/gi,
      /Vera\s+Farmiga|Patrick\s+Wilson|James\s+Wan/gi,
    ],
    year: [
      // Year requests
      /movie\s+from|film\s+from|movie\s+in|film\s+in/gi,
      /movie\s+of|film\s+of|movie\s+from\s+the|film\s+from\s+the/gi,
      // Year keywords
      /2023|2022|2021|2020|2019|2018|2017|2016|2015|2014/gi,
      /2013|2012|2011|2010|2009|2008|2007|2006|2005|2004/gi,
      /old\s+movie|new\s+movie|recent\s+movie|classic\s+movie/gi,
      /80s|90s|2000s|2010s|decade/gi,
    ],
  };

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly languageDetector: LanguageDetectorService,
  ) { }

  /**
   * Detect intent using hybrid approach: LLM analysis first, rule-based fallback
   * Enhanced with structured message analysis
   */
  async detectIntent(
    message: string,
    context?: {
      lastIntent?: string;
      suggestedMovieIds?: string[];
      messageHistory?: any[];
    },
  ): Promise<IntentResult> {
    try {
      // 1) Use LLM analysis first (structured JSON output)
      try {
        const analysisResult = await this.openaiService.analyzeMessage(message);

        // Map analysis intent to ConversationIntent
        const mappedIntent = this.mapAnalysisIntentToConversationIntent(
          analysisResult.intent,
        );

        // Extract entities from keywords
        const extractedEntities: IntentResult['extractedEntities'] = {
          keywords: analysisResult.expanded_keywords.length > 0
            ? analysisResult.expanded_keywords
            : analysisResult.keywords,
        };

        this.logger.debug(
          `LLM analysis: intent=${mappedIntent}, language=${analysisResult.language}, confidence=${analysisResult.confidence}`,
        );

        return {
          intent: mappedIntent,
          confidence: analysisResult.confidence,
          extractedEntities,
        };
      } catch (llmError) {
        this.logger.warn('LLM analysis failed, falling back to rule-based:', llmError);

        // Fallback to rule-based classification
        const languageDetection =
          await this.languageDetector.detectLanguage(message);
        const language = languageDetection.language;
        const ruleResult = this.classifyByRules(message, language);

        return ruleResult;
      }
    } catch (error) {
      this.logger.error('Intent classification failed:', error);
      return {
        intent: ConversationIntent.OFF_TOPIC,
        confidence: 0.5,
      };
    }
  }

  /**
   * Map MessageAnalysisResult intent to ConversationIntent
   */
  private mapAnalysisIntentToConversationIntent(
    analysisIntent: string,
  ): ConversationIntent {
    const intentMap: Record<string, ConversationIntent> = {
      greeting: ConversationIntent.GREETING,
      movie_recommendation: ConversationIntent.RECOMMENDATION,
      movie_similar: ConversationIntent.COMPARISON,
      random_movie: ConversationIntent.RANDOM,
      question: ConversationIntent.RECOMMENDATION, // Treat questions as recommendation requests
      small_talk: ConversationIntent.OFF_TOPIC,
      unknown: ConversationIntent.OFF_TOPIC,
    };

    return intentMap[analysisIntent.toLowerCase()] || ConversationIntent.OFF_TOPIC;
  }

  /**
   * Rule-based intent classification
   */
  private classifyByRules(
    message: string,
    language: SupportedLanguage,
  ): IntentResult {
    const normalizedMessage = message.toLowerCase().trim();
    const patterns =
      language === 'vi' ? this.VIETNAMESE_PATTERNS : this.ENGLISH_PATTERNS;

    let maxConfidence = 0;
    let detectedIntent = ConversationIntent.OFF_TOPIC;
    let extractedEntities: IntentResult['extractedEntities'] = {};

    // Check each intent pattern
    for (const [intentKey, intentPatterns] of Object.entries(patterns)) {
      let intentConfidence = 0;

      for (const pattern of intentPatterns) {
        if (pattern.test(normalizedMessage)) {
          intentConfidence += 1;
        }
      }

      // Normalize confidence (0-1)
      const normalizedConfidence = Math.min(
        intentConfidence / intentPatterns.length,
        1.0,
      );

      if (normalizedConfidence > maxConfidence) {
        maxConfidence = normalizedConfidence;
        detectedIntent = intentKey as ConversationIntent;
      }
    }

    // Extract entities for recommendation/comparison intents
    if (
      detectedIntent === ConversationIntent.RECOMMENDATION ||
      detectedIntent === ConversationIntent.COMPARISON
    ) {
      extractedEntities = this.extractEntities(normalizedMessage, language);
    }

    return {
      intent: detectedIntent,
      confidence: maxConfidence,
      extractedEntities,
    };
  }

  /**
   * LLM-based intent classification fallback
   */
  private async classifyByLLM(
    message: string,
    language: SupportedLanguage,
    context?: any,
  ): Promise<IntentResult> {
    const systemPrompt = `
      Classify the user's intent in this movie recommendation chat.
      Available intents: greeting, follow_up, recommendation, random, comparison, off_topic, farewell.
      
      Return JSON format:
      {
        "intent": "intent_name",
        "confidence": 0.0-1.0,
        "extractedEntities": {
          "movieNames": ["movie1", "movie2"],
          "keywords": ["keyword1", "keyword2"]
        }
      }
      
      Be conservative with confidence scores. If unsure, use off_topic.
      Respond in ${language === 'vi' ? 'Vietnamese' : 'English'}.
    `;

    const userPrompt = `
      Message: "${message}"
      Context: ${context ? JSON.stringify(context) : 'No context'}
    `;

    try {
      const completion = await this.openaiService.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        'gpt-4o-mini',
        0.3,
      );

      // Parse JSON response
      const result = JSON.parse(completion.content);
      return {
        intent: result.intent,
        confidence: result.confidence || 0.7,
        extractedEntities: result.extractedEntities,
      };
    } catch (error) {
      this.logger.error('LLM intent classification failed:', error);
      return {
        intent: ConversationIntent.OFF_TOPIC,
        confidence: 0.5,
      };
    }
  }

  /**
   * Extract movie names and keywords from message
   */
  private extractEntities(
    message: string,
    language: SupportedLanguage,
  ): IntentResult['extractedEntities'] {
    const entities: IntentResult['extractedEntities'] = {};

    // Simple movie name extraction (could be enhanced with NLP)
    const movieNamePattern =
      /['"](.*?)['"]|phim\s+([^,\.\s]+)|movie\s+([^,\.\s]+)/gi;
    const movieMatches = [...message.matchAll(movieNamePattern)];

    if (movieMatches.length > 0) {
      entities.movieNames = movieMatches
        .map((match) => match[1] || match[2] || match[3])
        .filter(Boolean);
    }

    // Extract keywords (could be enhanced)
    const keywords = this.extractKeywords(message, language);
    if (keywords.length > 0) {
      entities.keywords = keywords;
    }

    return entities;
  }

  /**
   * Extract keywords from message
   */
  private extractKeywords(
    message: string,
    language: SupportedLanguage,
  ): string[] {
    const keywords: string[] = [];

    // Genre keywords
    const genreKeywords =
      language === 'vi'
        ? [
          'hành động',
          'tình cảm',
          'hài',
          'kinh dị',
          'viễn tưởng',
          'phiêu lưu',
          'tâm lý',
        ]
        : [
          'action',
          'romance',
          'comedy',
          'horror',
          'sci-fi',
          'adventure',
          'drama',
        ];

    for (const genre of genreKeywords) {
      if (message.includes(genre)) {
        keywords.push(genre);
      }
    }

    // Year keywords
    const yearMatches = message.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches) {
      keywords.push(...yearMatches);
    }

    return keywords.slice(0, 5); // Limit to 5 keywords
  }
}
