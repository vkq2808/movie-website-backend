import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Movie } from '../movie/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

export enum RecommendationType {
  CONTENT_BASED = 'content_based',
  COLLABORATIVE = 'collaborative',
  HYBRID = 'hybrid',
  TRENDING = 'trending',
  WATCH_HISTORY = 'watch_history',
  FAVORITE_BASED = 'favorite_based',
}

export enum RecommendationSource {
  GENRES = 'genres',
  ACTORS = 'actors',
  DIRECTORS = 'directors',
  PRODUCTION_COMPANIES = 'production_companies',
  LANGUAGES = 'languages',
  USER_BEHAVIOR = 'user_behavior',
  SIMILAR_USERS = 'similar_users',
}

@Entity({ name: 'recommendations' })
@Index(['user', 'movie'], { unique: true })
@Index(['user', 'recommendation_type'])
@Index(['user', 'score'])
@Index(['created_at'])
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Movie, { onDelete: 'CASCADE' })
  movie: Movie;

  @Column({
    type: 'enum',
    enum: RecommendationType,
    default: RecommendationType.HYBRID,
  })
  recommendation_type: RecommendationType;

  @Column({
    type: 'enum',
    enum: RecommendationSource,
    array: true,
  })
  sources: RecommendationSource[];

  @Column({ type: 'float', default: 0 })
  score: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    matching_genres?: string[];
    matching_actors?: string[];
    matching_directors?: string[];
    matching_languages?: string[];
    user_similarity_score?: number;
    content_similarity_score?: number;
    trending_score?: number;
    reasoning?: string;
  };

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
