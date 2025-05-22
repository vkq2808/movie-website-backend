import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean, IsDate } from "class-validator";
import { Movie } from "../movie/movie.entity";
import { modelNames } from "@/common/constants/model-name.constant";

@Entity({ name: modelNames.VIDEO_MODEL_NAME })
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, movie => movie.videos)
  movie: Movie;

  @Column()
  @IsNotEmpty()
  @IsString()
  iso_649_1: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  iso_3166_1: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  name: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  key: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  site: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  size: number;

  @Column()
  @IsNotEmpty()
  @IsString()
  type: string;

  @Column({ default: false })
  @IsBoolean()
  official: boolean;

  @Column({ type: 'timestamp' })
  @IsDate()
  publishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}