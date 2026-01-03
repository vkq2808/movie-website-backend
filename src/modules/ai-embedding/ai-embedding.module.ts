import { InputSanitizer } from './services/input-sanitizer.service';
import { TextPreprocessingService } from './services/text-preprocessing.service';
import { LanguageDetectorService } from './services/language-detector.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MovieEmbedding } from './entities/movie-embedding.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { OpenAIService } from './services/openai.service';
import { RetryService } from './services/retry.service';
import { MovieEmbeddingService } from './services/movie-embedding.service';
import { MovieEmbeddingMigrationService } from './services/movie-embedding-migration.service';
import { AIChatMovieService } from './services/ai-chat-movie.service';
import { HallucinationGuardService } from './services/hallucination-guard.service';
import { AIEmbeddingController } from './controllers/ai-embedding.controller';
import { AIEmbeddingService } from './ai-embedding.service';
import { MovieCrew } from '../movie/entities/movie-crew.entity';
import { MovieCast } from '../movie/entities/movie-cast.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([MovieEmbedding, Movie, MovieCast, MovieCrew]),
  ],
  controllers: [AIEmbeddingController],
  providers: [
    OpenAIService,
    RetryService,
    MovieEmbeddingService,
    MovieEmbeddingMigrationService,
    AIChatMovieService,
    HallucinationGuardService,
    InputSanitizer,
    TextPreprocessingService,
    LanguageDetectorService,
    AIEmbeddingService,
  ],
  exports: [
    OpenAIService,
    RetryService,
    MovieEmbeddingService,
    MovieEmbeddingMigrationService,
    AIChatMovieService,
    HallucinationGuardService,
    InputSanitizer,
    TextPreprocessingService,
    LanguageDetectorService,
    AIEmbeddingService,
  ],
})
export class AIEmbeddingModule {}
