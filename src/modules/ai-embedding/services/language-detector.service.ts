import { Injectable, Logger } from '@nestjs/common';

export type SupportedLanguage = 'vi' | 'en';

interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number; // 0-1, how confident we are
  detected_method: 'heuristic' | 'llm'; // which method was used
}

@Injectable()
export class LanguageDetectorService {
  private readonly logger = new Logger('LanguageDetectorService');

  // Vietnamese character patterns
  private readonly vietnamesePatterns = {
    tones: /[\u0300\u0301\u0302\u0303\u0304\u0306\u0309\u0323]/g, // Vietnamese diacritical marks
    commonWords:
      /\b(phim|tôi|của|là|không|có|cái|được|và|trong|với|để|bạn|tệ|hay|chuyến|về|này|tại|hỏi|giáo|điều|cộng|hoàng)\b/gi,
    vowelsWithMarks:
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵỷỵ]/g,
  };

  /**
   * Detect language from input text using heuristic method
   * Checks for Vietnamese diacritical marks and common Vietnamese words
   */
  private detectLanguageHeuristic(text: string): {
    language: SupportedLanguage;
    confidence: number;
  } {
    if (!text || text.trim().length === 0) {
      return { language: 'en', confidence: 0.5 }; // Default fallback
    }

    const lowerText = text.toLowerCase();

    // Count Vietnamese diacritical marks
    const vietnameseToneMarks = (
      lowerText.match(this.vietnamesePatterns.tones) || []
    ).length;

    // Count Vietnamese vowels with marks (more reliable)
    const vietnameseVowels = (
      lowerText.match(this.vietnamesePatterns.vowelsWithMarks) || []
    ).length;

    // Count common Vietnamese words
    const vietnameseWords = (
      lowerText.match(this.vietnamesePatterns.commonWords) || []
    ).length;

    // Count total words
    const totalWords = lowerText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    // Scoring system
    let vietnameseScore = 0;

    // Vietnamese vowel marks are very reliable
    if (vietnameseVowels > 0) {
      vietnameseScore += Math.min(vietnameseVowels * 0.3, 0.6);
    }

    // Tone marks
    if (vietnameseToneMarks > 0) {
      vietnameseScore += Math.min(vietnameseToneMarks * 0.1, 0.2);
    }

    // Common Vietnamese words
    if (vietnameseWords > 0 && totalWords > 0) {
      const wordRatio = vietnameseWords / totalWords;
      vietnameseScore += Math.min(wordRatio * 0.2, 0.2);
    }

    // Normalize to 0-1 range
    const normalizedScore = Math.min(vietnameseScore, 1);

    // Threshold: if Vietnamese score > 0.3, likely Vietnamese
    if (normalizedScore > 0.3) {
      return { language: 'vi', confidence: Math.min(normalizedScore, 0.95) };
    }

    // Otherwise, assume English
    return { language: 'en', confidence: 1 - normalizedScore };
  }

  /**
   * Main detection method
   * Uses heuristic approach (fast, no API calls)
   * Can be extended with LLM fallback if needed
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Use heuristic method first
      const heuristicResult = this.detectLanguageHeuristic(text);

      // If confidence is low, could add LLM fallback here in future
      // For now, we'll use heuristic with reasonable confidence
      const finalConfidence =
        heuristicResult.confidence > 0.5 ? heuristicResult.confidence : 0.5; // Boost minimum confidence to 0.5 for low-confidence cases

      this.logger.debug(
        `Language detected: ${heuristicResult.language} (confidence: ${finalConfidence})`,
      );

      return {
        language: heuristicResult.language,
        confidence: finalConfidence,
        detected_method: 'heuristic',
      };
    } catch (err) {
      this.logger.warn(
        `Language detection failed: ${err?.message || String(err)}, defaulting to EN`,
      );
      // Safe fallback to English
      return {
        language: 'en',
        confidence: 0.5,
        detected_method: 'heuristic',
      };
    }
  }

  /**
   * Get language-specific system prompt instruction
   * Ensures LLM responds in the correct language
   */
  getLanguageSystemInstruction(language: SupportedLanguage): string {
    const instructions = {
      vi: 'Bạn là một trợ lý AI về phim ảnh. Hãy trả lời câu hỏi bằng tiếng Việt. Chỉ sử dụng thông tin từ danh sách phim được cung cấp.',
      en: 'You are a movie recommendation AI assistant. Please respond in English. Use ONLY the movies provided in the list.',
    };

    return instructions[language] || instructions.en;
  }

  /**
   * Get fallback message in the detected language
   */
  getOffTopicMessage(language: SupportedLanguage): string {
    const messages = {
      vi: 'Hiện tại tôi chỉ hỗ trợ thông tin về phim trong hệ thống. Bạn có thể hỏi về một bộ phim cụ thể không?',
      en: 'I can only provide information about movies in the system. Could you ask about a specific movie?',
    };

    return messages[language] || messages.vi; // Default to Vietnamese
  }

  /**
   * Get error fallback message in the detected language
   */
  getErrorMessage(language: SupportedLanguage): string {
    const messages = {
      vi: 'Xin lỗi, hiện tại hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
      en: 'Sorry, the system encountered an error. Please try again later.',
    };

    return messages[language] || messages.vi; // Default to Vietnamese
  }
}
