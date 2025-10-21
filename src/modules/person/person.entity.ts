import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';
import { MovieCast } from '@/modules/movie/entities/movie-cast.entity';
import { MovieCrew } from '@/modules/movie/entities/movie-crew.entity';

@Entity({ name: modelNames.PERSON })
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  @IsInt()
  @IsNotEmpty()
  original_id: number; // TMDB person id

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  @IsNotEmpty()
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsOptional()
  @IsString()
  original_name?: string;

  @Column({ type: 'int', nullable: true })
  @IsNotEmpty()
  @IsInt()
  gender: number;

  @Column({ type: 'boolean', default: false })
  @IsNotEmpty()
  adult: boolean;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  biography?: string;

  @Column({ type: 'date', nullable: true })
  @IsOptional()
  birthday?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  @IsOptional()
  @IsString()
  place_of_birth?: string;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  profile_image?: {
    url: string,
    alt: string,
    server_path?: string
  }

  @OneToMany(() => MovieCast, (mc) => mc.person)
  cast_credits: MovieCast[];

  @OneToMany(() => MovieCrew, (mc) => mc.person)
  crew_credits: MovieCrew[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
