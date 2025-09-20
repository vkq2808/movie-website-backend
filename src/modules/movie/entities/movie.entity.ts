import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Image } from '../../image/image.entity';
import { modelNames } from '@/common/constants/model-name.constant';
import { Language } from '../../language/language.entity';
import { Genre } from '../../genre/genre.entity';
import { AlternativeTitle } from './alternative-title.entity';

import { Video } from '../../video/video.entity';
import { AlternativeOverview } from './alternative-overview.entity';
import { ProductionCompany } from '../../production-company/production-company.entity';
import { MoviePurchase } from '../../movie-purchase/movie-purchase.entity';
import { MovieCast } from './movie-cast.entity';
import { MovieCrew } from './movie-crew.entity';
import { Keyword } from '../../keyword/keyword.entity';
import { AlternativeTagline } from './alternative-tagline.entity';
import { MovieStatus } from '@/common/enums';

@Entity({ name: modelNames.MOVIE })
@Index('idx_movie_popularity', ['popularity'])
@Index('idx_movie_vote_average', ['vote_average'])
@Index('idx_movie_release_date', ['release_date'])
@Index('idx_movie_status', ['status'])
export class Movie {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: false })
  adult: boolean;
  @OneToOne(() => Image, { eager: true, nullable: true })
  @JoinColumn({ name: 'backdrop_id' })
  backdrop: Image;

  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget: number; // genres of the movie
  @ManyToMany(() => Genre, (genre) => genre.movies, { eager: true })
  @IsOptional()
  @JoinTable({
    name: modelNames.MOVIE_GENRES,
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: Genre[];

  // production companies of the movie
  @ManyToMany(() => ProductionCompany, (company) => company.movies, {
    eager: false,
  })
  @JoinTable({
    name: modelNames.MOVIE_PRODUCTION_COMPANIES,
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'production_company_id',
      referencedColumnName: 'id',
    },
  })
  @IsOptional()
  production_companies: ProductionCompany[];

  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  homepage: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @IsString()
  imdb_id: string;
  @Column({ type: 'varchar', length: 20, nullable: true })
  @IsOptional()
  @IsString()
  wikidata_id?: string;
  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsString()
  facebook_id?: string;
  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsString()
  instagram_id?: string;
  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsString()
  twitter_id?: string;
  // original language of the movie
  @Index('idx_movie_original_language_id')
  @ManyToOne(() => Language, { eager: true, nullable: true })
  @JoinColumn({ name: 'original_language_id' })
  @IsOptional()
  original_language: Language;

  // original title of the movie  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  @Column({ type: 'varchar', nullable: true })
  original_title: string;

  // overview of the movie
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  overview: string;

  //popularity of the movie
  @Column({ type: 'float', default: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  popularity: number;

  // poster path of the movie
  @OneToOne(() => Image, { eager: true, nullable: true })
  @JoinColumn({ name: 'poster_id' })
  poster: Image;

  // release date of the movie
  @Column({ type: 'date', nullable: true })
  @IsOptional()
  @IsString()
  release_date: string;

  // revenue of the movie
  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue: number;

  // runtime of the movie in minutes
  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  runtime: number; // spoken languages of the movie
  @ManyToMany(() => Language, { eager: true })
  @JoinTable({
    name: 'movie_spoken_languages',
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'language_id', referencedColumnName: 'id' },
  })
  spoken_languages: Language[];
  @OneToMany(() => MovieCast, (mc) => mc.movie, { eager: false })
  cast: MovieCast[];

  @OneToMany(() => MovieCrew, (mc) => mc.movie, { eager: false })
  crew: MovieCrew[];

  @ManyToMany(() => Keyword, (k) => k.movies, { eager: true })
  @JoinTable({
    name: modelNames.MOVIE_KEYWORDS,
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'keyword_id', referencedColumnName: 'id' },
  })
  keywords: Keyword[];

  @OneToMany(() => AlternativeTagline, (at) => at.movie, {
    eager: false,
    cascade: true,
  })
  alternative_taglines: AlternativeTagline[];
  // content status for admin workflow
  @Column({
    type: 'enum',
    enum: MovieStatus,
    default: MovieStatus.DRAFT,
  })
  status: MovieStatus;

  // tagline of the movie
  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  tagline: string;

  @Column({ type: 'varchar', nullable: false })
  @IsString()
  title: string;

  // video of the movie (true/false)
  @Column({ type: 'boolean', default: false })
  @IsOptional()
  @IsNotEmpty({ message: 'Video is required' })
  video: boolean;

  // vote average of the movie
  @Column({ type: 'float', default: 0 })
  @IsNumber()
  @Min(0)
  @Max(10)
  vote_average: number;
  // vote count of the movie
  @Column({ type: 'int', default: 0 })
  @IsNumber()
  @Min(0)
  vote_count: number;

  // price of the movie for purchase
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @Column({ type: 'int', unique: true })
  @IsNotEmpty({ message: 'Original ID is required' })
  @IsNumber()
  original_id: number;

  // videos associated with the movie
  @OneToMany(() => Video, (video) => video.movie, {
    eager: true,
    nullable: true,
  })
  videos: Video[];

  @OneToMany(
    () => AlternativeTitle,
    (alternativeTitle) => alternativeTitle.movie,
    {
      eager: false,
      cascade: true,
    },
  )
  alternative_titles: AlternativeTitle[];

  @OneToMany(
    () => AlternativeOverview,
    (alternativeOverview) => alternativeOverview.movie,
    {
      eager: false,
      cascade: true,
    },
  )
  alternative_overviews: AlternativeOverview[];

  @OneToMany(() => MoviePurchase, (purchase) => purchase.movie)
  purchases: MoviePurchase[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Soft delete timestamp
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at: Date | null;
}
