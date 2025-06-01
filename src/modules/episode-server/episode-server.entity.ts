import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { Episode } from '../episode/episode.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.EPISODE_SERVER_MODEL_NAME })
export class EpisodeServer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Episode, episode => episode.servers)
  @IsNotEmpty({ message: 'EpisodeId is required' })
  episode: Episode;
  @Column()
  @IsNotEmpty({ message: 'Please enter your url' })
  @IsString()
  @IsUrl()
  url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}