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
import { Movie } from '../movie/entities/movie.entity';
import { Payment } from '../payment/payment.entity';
import { Chat } from '../chat/chat.entity';
import { Feedback } from '../feedback/feedback.entity';
import { SearchHistory } from '../search-history/search-history.entity';
import { WatchHistory } from '../watch-history/watch-history.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { MoviePurchase } from '../movie-purchase/movie-purchase.entity';
import { modelNames } from '@/common/constants/model-name.constant';
import { UserVoucher } from '../voucher/entities/user-voucher.entity';
import { TicketPurchase } from '../ticket-purchase/ticket-purchase.entity';
import { Favorite } from '../favorite/favorite.entity';

@Entity({ name: modelNames.USER })
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

  @Column({ default: false })
  is_banned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  banned_until?: Date; // For temporary bans

  @Column({ type: 'text', nullable: true })
  ban_reason?: string;

  @ManyToMany(() => Movie)
  @JoinTable({
    name: 'user_favorite_movies',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'movie_id' },
  })
  favorite_movies: Movie[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @OneToMany(() => Chat, (chat) => chat.sender)
  sending_chats: Chat[];

  @OneToMany(() => Chat, (chat) => chat.receiver)
  receiving_chats: Chat[];

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

  @OneToMany(() => UserVoucher, (uv) => uv.user)
  user_vouchers: UserVoucher[];

  @OneToMany(() => TicketPurchase, (purchase) => purchase.user)
  ticket_purchases: TicketPurchase[];

  @OneToMany(() => Favorite, (favorite) => favorite.user)
  favorites: Favorite[];

  @Column({ nullable: true })
  photo_url?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
