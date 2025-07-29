import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToOne,
} from 'typeorm';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Role } from '@/common/enums/role.enum';
import { Movie } from '../movie/movie.entity';
import { Payment } from '../payment/payment.entity';
import { Chat } from '../chat/chat.entity';
import { Feedback } from '../feedback/feedback.entity';
import { SearchHistory } from '../search-history/search-history.entity';
import { WatchHistory } from '../watch-history/watch-history.entity';
import { Wallet } from '../wallet/wallet.entity';
import { MoviePurchase } from '../movie-purchase/movie-purchase.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.USER_MODEL_NAME })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @Column({ unique: true })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @Column()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @Column({ type: 'date', nullable: true })
  birthdate?: Date;

  @Column({ type: 'enum', enum: Role, default: Role.Customer })
  role: Role;
  @Column({ default: false })
  is_verified: boolean;

  @Column({ default: true })
  is_active: boolean;

  @ManyToMany(() => Movie)
  @JoinTable({ name: 'user_favorite_movies' })
  favorite_movies: Movie[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @OneToMany(() => Chat, (chat) => chat.sender)
  chats: Chat[];

  @OneToMany(() => Feedback, (feedback) => feedback.user)
  feedbacks: Feedback[];

  @OneToMany(() => SearchHistory, (search_history) => search_history.user)
  search_histories: SearchHistory[];

  @OneToMany(() => WatchHistory, (watch_history) => watch_history.user)
  watch_histories: WatchHistory[];

  @OneToMany(() => MoviePurchase, (movie_purchase) => movie_purchase.user)
  movie_purchases: MoviePurchase[];

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @Column({ nullable: true })
  photo_url?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
