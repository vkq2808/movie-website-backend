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
  extractedEntities?: {
    movieNames?: string[];
    keywords?: string[];
  };
}

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger('IntentClassifierService');

  // Rule-based patterns for Vietnamese and English
  private readonly VIETNAMESE_PATTERNS = {
    greeting: [
      /xin\s+chào|chào\s+bạn|hello|hi|chào/,
      /có\s+thể\s+giúp|có\s+thể\s+hỏi|có\s+thể\s+gợi\s+ý/,
      /bạn\s+có\s+thể|bạn\s+có\s+khả\s+năng/,
    ],
    farewell: [
      /tạm\s+biệt|goodbye|bye|cảm\s+ơn|thank\s+you|ok|oke/,
      /không\s+cần|không\s+muốn|đủ\s+rồi/,
    ],
    followUp: [
      /còn\s+gì|khác|tiếp|thêm|và|hoặc/,
      /giống\s+phim|tương\s+tự|như\s+phim/,
      /có\s+gì|có\s+khác|có\s+gợi\s+ý/,
    ],
    recommendation: [
      /gợi\s+ý|recommend|recommendation|gợi\s+ý\s+phim|gợi\s+ý\s+một\s+phim/,
      /có\s+gợi\s+ý|có\s+phim|có\s+một\s+phim/,
      /tôi\s+muốn|tôi\s+cần|tôi\s+đang\s+tìm/,
      /tìm\s+phim|tìm\s+một\s+phim|tìm\s+gì/,
    ],
    random: [
      /ngẫu\s+nhiên|random|bất\s+kỳ|gì\s+cũng\s+được/,
      /có\s+gì|có\s+gì\s+đó|có\s+gì\s+khác/,
    ],
    comparison: [
      /so\s+sánh|compare|so\s+sánh\s+giữa|giữa\s+.*\s+và/,
      /cái\s+nào|nào\s+tốt|nào\s+hơn/,
    ],
  };

  private readonly ENGLISH_PATTERNS = {
    greeting: [
      /hello|hi|hey|greetings/,
      /can\s+you\s+help|can\s+you\s+recommend|can\s+you\s+suggest/,
      /are\s+you\s+able|are\s+you\s+capable/,
    ],
    farewell: [
      /goodbye|bye|thank\s+you|thanks|ok|oke/,
      /no\s+thanks|no\s+need|enough|done/,
    ],
    followUp: [
      /what\s+else|anything\s+else|more|another|also|or/,
      /similar\s+to|like\s+the\s+movie|like\s+that/,
      /any\s+other|any\s+different|any\s+suggestions/,
    ],
    recommendation: [
      /recommend|recommendation|suggest|suggest\s+me|suggest\s+a\s+movie/,
      /can\s+you\s+recommend|can\s+you\s+suggest|do\s+you\s+recommend/,
      /i\s+want|i\s+need|i\s+am\s+looking\s+for/,
      /looking\s+for|find\s+a\s+movie|find\s+something/,
    ],
    random: [
      /random|anything|whatever|any\s+movie/,
      /got\s+anything|got\s+something|got\s+any/,
    ],
    comparison: [
      /compare|compare\s+between|between\s+.*\s+and/,
      /which\s+one|which\s+is|which\s+better/,
    ],
  };

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly languageDetector: LanguageDetectorService,
  ) {}

  /**
   * Detect intent using hybrid approach: rule-based first, LLM fallback
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
      // 1) Detect language
      const languageDetection =
        await this.languageDetector.detectLanguage(message);
      const language = languageDetection.language;

      // 2) Try rule-based classification first
      const ruleResult = this.classifyByRules(message, language);
      if (ruleResult.confidence >= 0.8) {
        return ruleResult;
      }

      // 3) If rule-based confidence is low, use LLM fallback
      const llmResult = await this.classifyByLLM(message, language, context);
      return llmResult;
    } catch (error) {
      this.logger.error('Intent classification failed:', error);
      return {
        intent: ConversationIntent.OFF_TOPIC,
        confidence: 0.5,
      };
    }
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
      const normalizedConfidence = Math.min(intentConfidence / intentPatterns.length, 1.0);

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
    const movieNamePattern = /['"](.*?)['"]|phim\s+([^,\.\s]+)|movie\s+([^,\.\s]+)/gi;
    const movieMatches = [...message.matchAll(movieNamePattern)];
    
    if (movieMatches.length > 0) {
      entities.movieNames = movieMatches.map(match => 
        match[1] || match[2] || match[3]
      ).filter(Boolean);
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
  private extractKeywords(message: string, language: SupportedLanguage): string[] {
    const keywords: string[] = [];
    
    // Genre keywords
    const genreKeywords = language === 'vi' 
      ? ['hành động', 'tình cảm', 'hài', 'kinh dị', 'viễn tưởng', 'phiêu lưu', 'tâm lý']
      : ['action', 'romance', 'comedy', 'horror', 'sci-fi', 'adventure', 'drama'];
    
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