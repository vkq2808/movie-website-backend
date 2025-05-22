import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToOne } from 'typeorm';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Role } from '@/common/enums/role.enum';
import { Movie } from '../movie/movie.entity';
import { Payment } from '../payment/payment.entity';
import { Chat } from '../chat/chat.entity';
import { Feedback } from '../feedback/feedback.entity';
import { SearchHistory } from '../search-history/search-history.entity';
import { WatchHistory } from '../watch-history/watch-history.entity';
import { Wallet } from '../wallet/wallet.entity';
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
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Movie)
  @JoinTable({ name: 'user_favorite_movies' })
  favoriteMovies: Movie[];

  @OneToMany(() => Payment, payment => payment.user)
  payments: Payment[];

  @OneToMany(() => Chat, chat => chat.sender)
  chats: Chat[];

  @OneToMany(() => Feedback, feedback => feedback.user)
  feedbacks: Feedback[];

  @OneToMany(() => SearchHistory, searchHistory => searchHistory.user)
  searchHistories: SearchHistory[];

  @OneToMany(() => WatchHistory, watchHistory => watchHistory.user)
  watchHistories: WatchHistory[];

  @OneToOne(() => Wallet, wallet => wallet.user)
  wallet: Wallet[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}