import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { User } from '../auth/user.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.SEARCH_HISTORY })
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.search_histories)
  @IsNotEmpty({ message: 'User is required' })
  user: User;
  @Column()
  @IsNotEmpty({ message: 'Search query is required' })
  @IsString()
  search_query: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
