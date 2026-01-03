import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { MovieListItem } from './movie-list-item.entity';
import { modelNames } from '@/common/constants/model-name.constant';

export enum Visibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

@Entity({ name: modelNames.MOVIE_LIST })
@Index('idx_movie_list_user_id', ['user'])
@Index('idx_movie_list_visibility', ['visibility'])
export class MovieList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: Visibility, default: Visibility.PRIVATE })
  visibility: Visibility;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => MovieListItem, (item) => item.list, { cascade: true })
  items: MovieListItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at: Date | null;
}
