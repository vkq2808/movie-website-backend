import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Sanitization result object
 */
interface SanitizationResult {
  isValid: boolean;
  sanitized: string;
  reason?: string;
}

/**
 * LLM Output validation result
 */
interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Input Sanitizer - Prevents prompt injection and harmful inputs
 * CRITICAL: All user input MUST be sanitized before:
 * - Sending to LLM
 * - Using in vector search
 * - Using in keyword search
 */
@Injectable()
export class InputSanitizer {
  private readonly logger = new Logger('InputSanitizer');

  // Patterns that indicate prompt injection attempts
  private readonly DANGEROUS_PATTERNS = [
    /ignore\s+previous\s+instructions?/gi,
    /forget\s+everything\s+(?:before|above)/gi,
    /system\s+prompt\s+is/gi,
    /you\s+are\s+(?:actually\s+)?(?:chat)?gpt/gi,
    /act\s+as\s+(?:a\s+)?(?:ai|assistant|expert|system|administrator)/gi,
    /pretend\s+(?:you\s+)?(?:are|to\s+be|that\s+you)/gi,
    /tell\s+me\s+(?:the\s+)?(?:system\s+)?prompt/gi,
    /what\s+(?:were\s+)?you\s+(?:told\s+)?to\s+do/gi,
    /jailbreak|bypass|escape|override/gi,
    /sql\s+injection|';\s*(?:drop|delete|update)/gi,
    /(?:javascript|script):/gi,
  ];

  // Max input length (prevents DoS)
  private readonly MAX_INPUT_LENGTH = 2000;
  private readonly MIN_INPUT_LENGTH = 1;
  private readonly MAX_REPEATED_CHARS = 100; // Detect spam like "!!!!!!!!!"

  /**
   * Sanitize user input - returns safe string for LLM/search
   * Returns result object with validation status
   */
  sanitizeUserInput(input: string): SanitizationResult {
    if (!input || typeof input !== 'string') {
      return {
        isValid: false,
        sanitized: '',
        reason: 'Input must be a non-empty string',
      };
    }

    // Check length
    if (input.length < this.MIN_INPUT_LENGTH) {
      return {
        isValid: false,
        sanitized: '',
        reason: 'Input is too short',
      };
    }

    if (input.length > this.MAX_INPUT_LENGTH) {
      return {
        isValid: false,
        sanitized: '',
        reason: `Input exceeds maximum length of ${this.MAX_INPUT_LENGTH} characters`,
      };
    }

    // Check for dangerous patterns (prompt injection)
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        this.logger.warn(
          `Dangerous pattern detected in input: ${pattern.toString()}`,
        );
        return {
          isValid: false,
          sanitized: '',
          reason: 'Input contains invalid patterns. Please ask a genuine question about movies.',
        };
      }
    }

    // Check for character explosion (spam detection)
    const repeated = /(.)\1{50,}/;
    if (repeated.test(input)) {
      this.logger.warn('Character explosion detected in input');
      return {
        isValid: false,
        sanitized: '',
        reason: 'Input contains excessive repeated characters',
      };
    }

    // Trim whitespace
    const trimmed = input.trim();

    // Final validation
    if (trimmed.length < this.MIN_INPUT_LENGTH) {
      return {
        isValid: false,
        sanitized: '',
        reason: 'Input is empty after trimming',
      };
    }

    return {
      isValid: true,
      sanitized: trimmed,
    };
  }

  /**
   * Additional sanitization for LLM prompts
   * Escapes special characters that could affect LLM behavior
   */
  sanitizeForLLMPrompt(input: string): string {
    if (!input) {
      return '';
    }

    // Escape backslashes first
    let sanitized = input.replace(/\\/g, '\\\\');

    // Escape quotes
    sanitized = sanitized.replace(/"/g, '\\"');
    sanitized = sanitized.replace(/'/g, "\\'");

    // Escape newlines/special chars in a way that's safe for JSON
    sanitized = sanitized.replace(/\n/g, '\\n');
    sanitized = sanitized.replace(/\r/g, '\\r');
    sanitized = sanitized.replace(/\t/g, '\\t');

    return sanitized;
  }

  /**
   * Validate LLM output before returning to user
   * Ensures response is safe and valid JSON
   */
  validateLLMOutput(output: string): ValidationResult {
    if (!output || typeof output !== 'string') {
      return {
        isValid: false,
        reason: 'LLM output is invalid or empty',
      };
    }

    // Check length (shouldn't be excessive)
    if (output.length > 10000) {
      return {
        isValid: false,
        reason: 'LLM output exceeds safe length limit',
      };
    }

    // Try to parse if it's supposed to be JSON
    if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
      try {
        JSON.parse(output);
      } catch {
        return {
          isValid: false,
          reason: 'LLM output is not valid JSON',
        };
      }
    }

    // Check for suspicious patterns in output (hallucination)
    const suspiciousPatterns = [
      /api[_-]?key|secret[_-]?key|password/gi,
      /delete|drop\s+table|truncate/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(output)) {
        this.logger.warn(`Suspicious pattern detected in LLM output: ${pattern.toString()}`);
        return {
          isValid: false,
          reason: 'LLM response contains suspicious content',
        };
      }
    }

    return {
      isValid: true,
    };
  }

  /**
   * Get safe representation for logging
   * Shows length instead of content to prevent data leakage
   */
  getSafeLogRepresentation(text: string): string {
    if (!text) {
      return '(empty)';
    }

    // Return first 50 chars if short, or show length
    if (text.length <= 50) {
      return `(text, ${text.length} chars)`;
    }

    return `(message, ${text.length} chars)`;
  }

  /**
   * Hash text for audit trail without exposing content
   * Use SHA256 to create a correlation ID for logs
   */
  hashForLogging(text: string): string {
    if (!text) {
      return 'empty-hash';
    }

    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16); // Take first 16 chars
  }

  /**
   * Check if input looks like a genuine movie question
   * Not security-critical, just a heuristic
   */
  hasMovieKeywords(input: string): boolean {
    const movieKeywords = [
      'movie',
      'film',
      'watch',
      'actor',
      'director',
      'genre',
      'recommend',
      'cinema',
      'series',
      'show',
      'watch',
      'netflix',
      'imdb',
      'rating',
      'release',
    ];

    const lowerInput = input.toLowerCase();
    return movieKeywords.some((keyword) => lowerInput.includes(keyword));
  }
}
