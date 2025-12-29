import { Injectable, Logger } from '@nestjs/common';

/**
 * Text Preprocessing - Ensures quality embeddings
 * CRITICAL: Improper preprocessing → meaningless vectors → broken search
 */
@Injectable()
export class TextPreprocessingService {
  private readonly logger = new Logger('TextPreprocessingService');

  // Token estimate (rough): 1 token ≈ 4 chars
  private readonly MAX_TOKENS = 8192; // Safe limit for OpenAI
  private readonly CHARS_PER_TOKEN = 4;
  private readonly MAX_CHARS = this.MAX_TOKENS * this.CHARS_PER_TOKEN;

  /**
   * Preprocess text before embedding
   * Removes noise, normalizes, chunks appropriately
   */
  preprocessForEmbedding(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let processed = text;

    // Step 1: Remove HTML tags and entities
    processed = this.removeHTMLAndMarkdown(processed);

    // Step 2: Normalize whitespace
    processed = this.normalizeWhitespace(processed);

    // Step 3: Remove excessive punctuation/symbols
    processed = this.cleanPunctuation(processed);

    // Step 4: Normalize case (lowercase for consistency)
    processed = processed.toLowerCase();

    // Step 5: Trim to safe length
    processed = this.truncateToTokenLimit(processed);

    // Step 6: Final validation
    if (!processed || processed.trim().length === 0) {
      this.logger.warn('Text preprocessing resulted in empty string');
      return '(empty content)';
    }

    return processed.trim();
  }

  /**
   * Remove HTML, XML, JSON tags and markdown
   */
  private removeHTMLAndMarkdown(text: string): string {
    // Remove HTML/XML tags
    let result = text.replace(/<[^>]*>/g, ' ');

    // Remove markdown syntax
    result = result.replace(/#+\s/g, ''); // Headings
    result = result.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1'); // Bold/italic
    result = result.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Links
    result = result.replace(/`([^`]+)`/g, '$1'); // Code

    // Remove JSON quotes/brackets
    result = result.replace(/[{}[\]"']/g, ' ');

    return result;
  }

  /**
   * Normalize whitespace (multiple spaces → single space)
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, ' ') // Windows newlines
      .replace(/\n/g, ' ') // Unix newlines
      .replace(/\t/g, ' ') // Tabs
      .replace(/\s+/g, ' '); // Multiple spaces
  }

  /**
   * Clean excessive punctuation while keeping essential ones
   */
  private cleanPunctuation(text: string): string {
    // Remove repeated punctuation (e.g., "!!!" → "!")
    let result = text.replace(/([.!?,;:—-])\1+/g, '$1');

    // Remove trailing punctuation at end of text
    result = result.replace(/([.!?,;:—-\s])+$/g, '');

    return result;
  }

  /**
   * Truncate to safe token limit
   * Preserves semantic completeness by truncating at sentence boundary
   */
  private truncateToTokenLimit(text: string): string {
    if (text.length <= this.MAX_CHARS) {
      return text;
    }

    // Try to truncate at sentence boundary
    const truncated = text.substring(0, this.MAX_CHARS);

    // Find last period, question mark, or exclamation
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!'),
    );

    if (lastSentenceEnd > this.MAX_CHARS * 0.7) {
      // Truncate at sentence if it's reasonably recent
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // Otherwise truncate at last word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace);
    }

    return truncated;
  }

  /**
   * Chunk long text into smaller pieces for embedding
   * Used when preprocessing very long documents
   *
   * Returns array of chunks with significant overlap for context
   */
  chunkText(
    text: string,
    chunkSize: number = 1024, // chars
    overlapSize: number = 128, // chars
  ): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    const processed = this.preprocessForEmbedding(text);
    const chunks: string[] = [];

    if (processed.length <= chunkSize) {
      return [processed];
    }

    for (let i = 0; i < processed.length; i += chunkSize - overlapSize) {
      const chunk = processed.substring(i, i + chunkSize);

      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }

      // Stop if we've reached the end
      if (i + chunkSize >= processed.length) {
        break;
      }
    }

    this.logger.debug(
      `Text chunked into ${chunks.length} pieces (original: ${text.length} chars)`,
    );

    return chunks;
  }

  /**
   * Validate that preprocessing didn't lose too much information
   */
  validatePreprocessingQuality(
    original: string,
    processed: string,
  ): { isValid: boolean; quality: number } {
    if (!original || !processed) {
      return { isValid: false, quality: 0 };
    }

    // Check if we retained at least some meaningful content
    const retentionRatio = processed.length / original.length;

    // Accept if we kept at least 10% of original (after removing markup/whitespace)
    const isValid = retentionRatio >= 0.1 && processed.length > 20;

    return {
      isValid,
      quality: Math.min(retentionRatio * 100, 100),
    };
  }

  /**
   * Extract key terms from text for keyword extraction
   * Returns top N most relevant terms
   */
  extractKeyTerms(text: string, topN: number = 10): string[] {
    const processed = this.preprocessForEmbedding(text);

    // Split into words, filter by length and common words
    const commonWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'which',
      'who',
      'when',
      'where',
      'why',
      'how',
    ]);

    const words = processed
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !commonWords.has(w.toLowerCase()),
      )
      .map((w) => w.toLowerCase())
      .slice(0, topN);

    return [...new Set(words)]; // Remove duplicates
  }
}
