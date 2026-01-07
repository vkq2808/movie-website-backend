import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';

/**
 * Cache configuration interface
 */
interface CacheConfig {
  max: number;
  ttl: number;
  updateAgeOnGet?: boolean;
}

/**
 * Performance cache service for expensive operations
 * Provides LRU caching for intent classification, language detection, and semantic search
 * CRITICAL: Memory-aware caching to prevent aggressive cache competition
 */
@Injectable()
export class PerformanceCacheService {
  private readonly logger = new Logger('PerformanceCacheService');

  // LRU caches for different operation types with memory bounds
  private intentCache: LRUCache<string, any>;
  private languageCache: LRUCache<string, any>;
  private semanticSearchCache: LRUCache<string, any>;
  private promptTemplateCache: LRUCache<string, string>;
  private movieContextCache: LRUCache<string, any>;

  // Memory usage tracking
  private totalCacheSize = 0;
  private readonly MAX_TOTAL_CACHE_SIZE = 5000; // Hard limit on total cache entries

  constructor(private readonly configService: ConfigService) {
    this.initializeCaches();
  }

  /**
   * Initialize all LRU caches with memory bounds
   */
  private initializeCaches(): void {
    // CRITICAL: Set conservative cache sizes to prevent memory competition
    const intentCacheConfig: CacheConfig = {
      max: this.configService.get<number>('CACHE_INTENT_MAX_SIZE', 500), // Reduced from 1000
      ttl: this.configService.get<number>(
        'CACHE_INTENT_TTL_MS',
        15 * 60 * 1000,
      ), // 15 minutes
      updateAgeOnGet: true,
    };

    const languageCacheConfig: CacheConfig = {
      max: this.configService.get<number>('CACHE_LANGUAGE_MAX_SIZE', 250), // Reduced from 500
      ttl: this.configService.get<number>(
        'CACHE_LANGUAGE_TTL_MS',
        60 * 60 * 1000,
      ), // 1 hour
      updateAgeOnGet: true,
    };

    const semanticSearchCacheConfig: CacheConfig = {
      max: this.configService.get<number>('CACHE_SEARCH_MAX_SIZE', 250), // Reduced from 500
      ttl: this.configService.get<number>(
        'CACHE_SEARCH_TTL_MS',
        30 * 60 * 1000,
      ), // 30 minutes
      updateAgeOnGet: true,
    };

    const promptTemplateCacheConfig: CacheConfig = {
      max: this.configService.get<number>('CACHE_PROMPT_MAX_SIZE', 50), // Reduced from 100
      ttl: this.configService.get<number>(
        'CACHE_PROMPT_TTL_MS',
        60 * 60 * 1000,
      ), // 1 hour
      updateAgeOnGet: false, // Templates don't change often
    };

    const movieContextCacheConfig: CacheConfig = {
      max: this.configService.get<number>('CACHE_MOVIE_MAX_SIZE', 500), // Reduced from 1000
      ttl: this.configService.get<number>('CACHE_MOVIE_TTL_MS', 10 * 60 * 1000), // 10 minutes
      updateAgeOnGet: true,
    };

    this.intentCache = new LRUCache<string, any>(intentCacheConfig);
    this.languageCache = new LRUCache<string, any>(languageCacheConfig);
    this.semanticSearchCache = new LRUCache<string, any>(
      semanticSearchCacheConfig,
    );
    this.promptTemplateCache = new LRUCache<string, string>(
      promptTemplateCacheConfig,
    );
    this.movieContextCache = new LRUCache<string, any>(movieContextCacheConfig);

    this.logger.log(
      'Performance caches initialized successfully with memory bounds',
    );
  }

  /**
   * Cache intent classification results with memory bounds
   */
  async cacheIntentResult(
    input: string,
    context: any,
    result: any,
  ): Promise<void> {
    // CRITICAL: Check memory bounds before caching
    if (this.totalCacheSize >= this.MAX_TOTAL_CACHE_SIZE) {
      this.logger.warn('Cache memory limit reached, skipping intent cache');
      return;
    }

    const cacheKey = this.generateIntentCacheKey(input, context);
    this.intentCache.set(cacheKey, result);
    this.totalCacheSize++;
    this.logger.debug(`Cached intent result for key: ${cacheKey}`);
  }

  /**
   * Get cached intent classification result
   */
  async getCachedIntentResult(
    input: string,
    context: any,
  ): Promise<any | null> {
    const cacheKey = this.generateIntentCacheKey(input, context);
    const result = this.intentCache.get(cacheKey);

    if (result) {
      this.logger.debug(`Cache hit for intent: ${cacheKey}`);
    }

    return result;
  }

  /**
   * Cache language detection results with memory bounds
   */
  async cacheLanguageResult(input: string, result: any): Promise<void> {
    // CRITICAL: Check memory bounds before caching
    if (this.totalCacheSize >= this.MAX_TOTAL_CACHE_SIZE) {
      this.logger.warn('Cache memory limit reached, skipping language cache');
      return;
    }

    const cacheKey = this.generateLanguageCacheKey(input);
    this.languageCache.set(cacheKey, result);
    this.totalCacheSize++;
    this.logger.debug(`Cached language result for key: ${cacheKey}`);
  }

  /**
   * Get cached language detection result
   */
  async getCachedLanguageResult(input: string): Promise<any | null> {
    const cacheKey = this.generateLanguageCacheKey(input);
    const result = this.languageCache.get(cacheKey);

    if (result) {
      this.logger.debug(`Cache hit for language: ${cacheKey}`);
    }

    return result;
  }

  /**
   * Cache semantic search results with memory bounds
   */
  async cacheSemanticSearchResult(
    query: string,
    topK: number,
    threshold: number,
    results: any,
  ): Promise<void> {
    // CRITICAL: Check memory bounds before caching
    if (this.totalCacheSize >= this.MAX_TOTAL_CACHE_SIZE) {
      this.logger.warn('Cache memory limit reached, skipping search cache');
      return;
    }

    const cacheKey = this.generateSemanticSearchCacheKey(
      query,
      topK,
      threshold,
    );
    this.semanticSearchCache.set(cacheKey, results);
    this.totalCacheSize++;
    this.logger.debug(`Cached semantic search result for key: ${cacheKey}`);
  }

  /**
   * Get cached semantic search result
   */
  async getCachedSemanticSearchResult(
    query: string,
    topK: number,
    threshold: number,
  ): Promise<any | null> {
    const cacheKey = this.generateSemanticSearchCacheKey(
      query,
      topK,
      threshold,
    );
    const result = this.semanticSearchCache.get(cacheKey);

    if (result) {
      this.logger.debug(`Cache hit for semantic search: ${cacheKey}`);
    }

    return result;
  }

  /**
   * Cache prompt templates with memory bounds
   */
  async cachePromptTemplate(
    language: string,
    intent: string,
    template: string,
  ): Promise<void> {
    // CRITICAL: Check memory bounds before caching
    if (this.totalCacheSize >= this.MAX_TOTAL_CACHE_SIZE) {
      this.logger.warn('Cache memory limit reached, skipping template cache');
      return;
    }

    const cacheKey = this.generatePromptTemplateCacheKey(language, intent);
    this.promptTemplateCache.set(cacheKey, template);
    this.totalCacheSize++;
    this.logger.debug(`Cached prompt template for key: ${cacheKey}`);
  }

  /**
   * Get cached prompt template
   */
  async getCachedPromptTemplate(
    language: string,
    intent: string,
  ): Promise<string | null> {
    const cacheKey = this.generatePromptTemplateCacheKey(language, intent);
    const template = this.promptTemplateCache.get(cacheKey);

    if (template) {
      this.logger.debug(`Cache hit for prompt template: ${cacheKey}`);
    }

    return template;
  }

  /**
   * Cache movie context for response composition with memory bounds
   */
  async cacheMovieContext(movieIds: string[], context: any): Promise<void> {
    // CRITICAL: Check memory bounds before caching
    if (this.totalCacheSize >= this.MAX_TOTAL_CACHE_SIZE) {
      this.logger.warn(
        'Cache memory limit reached, skipping movie context cache',
      );
      return;
    }

    const cacheKey = this.generateMovieContextCacheKey(movieIds);
    this.movieContextCache.set(cacheKey, context);
    this.totalCacheSize++;
    this.logger.debug(`Cached movie context for key: ${cacheKey}`);
  }

  /**
   * Get cached movie context
   */
  async getCachedMovieContext(movieIds: string[]): Promise<any | null> {
    const cacheKey = this.generateMovieContextCacheKey(movieIds);
    const context = this.movieContextCache.get(cacheKey);

    if (context) {
      this.logger.debug(`Cache hit for movie context: ${cacheKey}`);
    }

    return context;
  }

  /**
   * Generate cache key for intent classification
   */
  private generateIntentCacheKey(input: string, context: any): string {
    const normalizedInput = this.normalizeInput(input);
    const contextHash = this.hashContext(context);
    return `intent:${normalizedInput}:${contextHash}`;
  }

  /**
   * Generate cache key for language detection
   */
  private generateLanguageCacheKey(input: string): string {
    const normalizedInput = this.normalizeInput(input);
    return `language:${normalizedInput}`;
  }

  /**
   * Generate cache key for semantic search
   */
  private generateSemanticSearchCacheKey(
    query: string,
    topK: number,
    threshold: number,
  ): string {
    const normalizedQuery = this.normalizeInput(query);
    return `search:${normalizedQuery}:${topK}:${threshold}`;
  }

  /**
   * Generate cache key for prompt template
   */
  private generatePromptTemplateCacheKey(
    language: string,
    intent: string,
  ): string {
    return `template:${language}:${intent}`;
  }

  /**
   * Generate cache key for movie context
   */
  private generateMovieContextCacheKey(movieIds: string[]): string {
    const sortedIds = movieIds.slice().sort();
    const idsHash = this.hashString(sortedIds.join(','));
    return `movie_context:${idsHash}`;
  }

  /**
   * Normalize input text for consistent caching
   */
  private normalizeInput(input: string): string {
    return input.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200); // Limit length for cache key
  }

  /**
   * Generate hash for context object
   */
  private hashContext(context: any): string {
    const contextString = JSON.stringify(context);
    return this.hashString(contextString);
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear all caches (for testing or maintenance)
   */
  async clearAllCaches(): Promise<void> {
    this.intentCache.clear();
    this.languageCache.clear();
    this.semanticSearchCache.clear();
    this.promptTemplateCache.clear();
    this.movieContextCache.clear();
    this.totalCacheSize = 0;
    this.logger.log('All caches cleared');
  }

  /**
   * Get cache statistics with memory usage
   */
  getCacheStats(): {
    intent: { size: number; hits: number; misses: number };
    language: { size: number; hits: number; misses: number };
    semanticSearch: { size: number; hits: number; misses: number };
    promptTemplate: { size: number; hits: number; misses: number };
    movieContext: { size: number; hits: number; misses: number };
    memory: { totalSize: number; maxSize: number; utilization: number };
  } {
    const stats = {
      intent: {
        size: this.intentCache.size,
        hits: this.intentCache.stats?.hits || 0,
        misses: this.intentCache.stats?.misses || 0,
      },
      language: {
        size: this.languageCache.size,
        hits: this.languageCache.stats?.hits || 0,
        misses: this.languageCache.stats?.misses || 0,
      },
      semanticSearch: {
        size: this.semanticSearchCache.size,
        hits: this.semanticSearchCache.stats?.hits || 0,
        misses: this.semanticSearchCache.stats?.misses || 0,
      },
      promptTemplate: {
        size: this.promptTemplateCache.size,
        hits: this.promptTemplateCache.stats?.hits || 0,
        misses: this.promptTemplateCache.stats?.misses || 0,
      },
      movieContext: {
        size: this.movieContextCache.size,
        hits: this.movieContextCache.stats?.hits || 0,
        misses: this.movieContextCache.stats?.misses || 0,
      },
      memory: {
        totalSize: this.totalCacheSize,
        maxSize: this.MAX_TOTAL_CACHE_SIZE,
        utilization: (this.totalCacheSize / this.MAX_TOTAL_CACHE_SIZE) * 100,
      },
    };

    // Log memory usage if approaching limits
    if (stats.memory.utilization > 80) {
      this.logger.warn(
        `Cache memory utilization high: ${stats.memory.utilization.toFixed(1)}%`,
      );
    }

    return stats;
  }

  /**
   * Invalidate cache entries for specific movie IDs (when movie data changes)
   */
  async invalidateMovieCache(movieIds: string[]): Promise<void> {
    // Clear movie context cache for affected movies
    movieIds.forEach((id) => {
      const keys = Array.from(this.movieContextCache.keys());
      keys.forEach((key) => {
        if (typeof key === 'string' && key.includes(id)) {
          this.movieContextCache.delete(key);
          this.totalCacheSize = Math.max(0, this.totalCacheSize - 1);
        }
      });
    });

    this.logger.debug(
      `Invalidated cache entries for movie IDs: ${movieIds.join(', ')}`,
    );
  }
}
