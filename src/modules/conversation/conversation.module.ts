import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationFlowService } from './services/conversation-flow.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { ConversationContextService } from './services/conversation-context.service';
import { ResponseComposerService } from './services/response-composer.service';
import { RateLimitService } from './services/rate-limit.service';
import { GreetingStrategy } from './strategies/greeting.strategy';
import { SemanticSearchStrategy } from './strategies/semantic-search.strategy';
import { RandomSuggestionStrategy } from './strategies/random-suggestion.strategy';
import { FollowUpStrategy } from './strategies/follow-up.strategy';
import { ComparisonStrategy } from './strategies/comparison.strategy';
import { OffTopicStrategy } from './strategies/off-topic.strategy';
import { ConversationSession } from './entities/conversation-session.entity';
import { Chat } from '@/modules/chat/chat.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { User } from '@/modules/user/user.entity';
import { AIEmbeddingModule } from '@/modules/ai-embedding';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([ConversationSession, Chat, Movie, User]),
    AIEmbeddingModule,
  ],
  providers: [
    ConversationFlowService,
    IntentClassifierService,
    ConversationContextService,
    ResponseComposerService,
    GreetingStrategy,
    SemanticSearchStrategy,
    RandomSuggestionStrategy,
    FollowUpStrategy,
    ComparisonStrategy,
    OffTopicStrategy,
  ],
  exports: [
    ConversationFlowService,
    IntentClassifierService,
    ConversationContextService,
    ResponseComposerService,
  ],
})
export class ConversationModule {}
