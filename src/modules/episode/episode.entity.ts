import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, CreateDateColumn, UpdateDateColumn, JoinTable } from 'typeorm';
import { IsNotEmpty, IsString, IsNumber, IsDate } from 'class-validator';
import { Movie } from '../movie/movie.entity';
import { EpisodeServer } from '../episode-server/episode-server.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.EPISODE_MODEL_NAME })
export class Episode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie)
  @IsNotEmpty({ message: 'MovieId is required' })
  movie: Movie;

  @ManyToMany(() => EpisodeServer)
  @JoinTable({
    name: modelNames.EPISODE_SERVERS,
    joinColumn: { name: 'episode_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'server_id', referencedColumnName: 'id' }
  })
  servers: EpisodeServer[];

  @Column()
  @IsNotEmpty({ message: 'Please enter your title' })
  @IsString()
  title: string;

  @Column({ type: 'text' })
  @IsNotEmpty({ message: 'Please enter your description' })
  @IsString()
  description: string;

  @Column()
  @IsNotEmpty({ message: 'Please enter your duration' })
  @IsNumber()
  duration: number;
  @Column({ type: 'timestamp' })
  @IsNotEmpty({ message: 'Please enter your release date' })
  @IsDate()
  released_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}