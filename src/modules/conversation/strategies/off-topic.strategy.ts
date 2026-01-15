import { Injectable } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';
import { LanguageDetectorService } from '@/modules/ai-embedding/services/language-detector.service';

@Injectable()
export class OffTopicStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.OFF_TOPIC;

  constructor(private readonly languageDetector: LanguageDetectorService) {
    super();
  }

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { message, context } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates();

    // Get suggested keywords for off-topic
    const followUpKeywords = this.getFollowUpKeywords(
      this.intent,
      language,
      input.context.lastIntent
        ? { keywords: [input.context.lastIntent] }
        : undefined,
    );

    const assistantText = templates.noResults;

    return {
      movies: [],
      assistantText,
      followUpKeywords,
    };
  }
}
