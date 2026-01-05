import { Injectable } from '@nestjs/common';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { BaseStrategy, StrategyInput, StrategyOutput } from './base.strategy';
import { ConversationIntent } from '../services/intent-classifier.service';

@Injectable()
export class GreetingStrategy extends BaseStrategy {
  readonly intent = ConversationIntent.GREETING;

  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const { context, intent } = input;
    const language = context.language || 'vi';
    const templates = this.getTemplates(language);

    // Get suggested keywords for greeting
    const followUpKeywords = this.getFollowUpKeywords(
      intent,
      language,
      input.context.lastIntent
        ? { keywords: [input.context.lastIntent] }
        : undefined,
    );

    const assistantText = templates.greeting;

    return {
      movies: [],
      assistantText,
      followUpKeywords,
    };
  }
}
