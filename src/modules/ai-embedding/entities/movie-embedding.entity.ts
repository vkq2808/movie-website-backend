import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.MOVIE_EMBEDDING })
@Index('idx_movie_embedding_created_at', ['created_at'])
export class MovieEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  /**
   * Vector embedding as float array
   * Compatible with both float[] and pgvector
   */
  @Column({
    type: 'simple-array',
    comment: 'Text embedding vector from OpenAI',
  })
  embedding: number[];

  /**
   * Normalized text content that was embedded
   */
  @Column({
    type: 'text',
    comment: 'Normalized movie content (title, genres, overview, cast, etc.)',
  })
  content: string;

  /**
   * OpenAI model used for embedding
   */
  @Column({
    type: 'varchar',
    length: 100,
    default: 'text-embedding-3-large',
  })
  model: string;

  /**
   * Embedding dimensions
   */
  @Column({
    type: 'int',
    default: 3072,
    comment: 'Dimension of the embedding vector',
  })
  embedding_dimension: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
