import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger('RateLimitService');
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly requests = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {
    this.maxRequests = parseInt(
      this.configService.get<string>(
        'CONVERSATION_RATE_LIMIT_MAX_REQUESTS',
        '10',
      ),
      10,
    );
    this.windowMs = parseInt(
      this.configService.get<string>(
        'CONVERSATION_RATE_LIMIT_WINDOW_MS',
        '30000',
      ),
      10,
    );
  }

  /**
   * Check if session is rate limited
   */
  isRateLimited(sessionId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get requests for this session
    let requests = this.requests.get(sessionId) || [];

    // Filter out old requests outside the window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    // Check if within limit
    if (requests.length >= this.maxRequests) {
      this.logger.warn(`Rate limit exceeded for session: ${sessionId}`);
      return true;
    }

    // Add current request
    requests.push(now);
    this.requests.set(sessionId, requests);

    return false;
  }

  /**
   * Clear rate limit data for a session (optional cleanup)
   */
  clearSession(sessionId: string): void {
    this.requests.delete(sessionId);
  }

  /**
   * Get remaining requests for a session
   */
  getRemainingRequests(sessionId: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let requests = this.requests.get(sessionId) || [];
    requests = requests.filter((timestamp) => timestamp > windowStart);

    return Math.max(0, this.maxRequests - requests.length);
  }
}
