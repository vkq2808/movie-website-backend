import { DataSource } from 'typeorm';
import { Keyword } from '@/modules/keyword/keyword.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import dotenv from 'dotenv';
import { Genre } from '@/modules/genre/genre.entity';
import { ProductionCompany } from '@/modules/production-company/production-company.entity';
import { Language } from '@/modules/language/language.entity';
import { User } from '@/modules/user/user.entity';
import { Person } from '@/modules/person/person.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { MovieCast } from '@/modules/movie/entities/movie-cast.entity';
import { MovieCrew } from '@/modules/movie/entities/movie-crew.entity';
import { Payment } from '@/modules/payment/payment.entity';
import { Recommendation } from '@/modules/recommendation/recommendation.entity';
import { Video } from '@/modules/video/video.entity';
import { Chat } from '@/modules/chat/chat.entity';
import { Wallet } from '@/modules/wallet';
import { WatchProvider } from '@/modules/watch-provider/watch-provider.entity';
import { Feedback } from '@/modules/feedback/feedback.entity';
import { SearchHistory } from '@/modules/search-history/search-history.entity';
import { MoviePurchase } from '@/modules/movie-purchase/movie-purchase.entity';
import { SystemSettingsEntity } from '@/modules/settings/settings.entity';
import path from 'path';
import * as fs from 'fs';
dotenv.config();


export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? "postgresql://<<user>>:<<password>>@<<host>>/<<databae-name>>",
  entities: [
    Keyword,
    Movie,
    Genre,
    ProductionCompany,
    Language,
    User,
    Person,
    WatchHistory,
    MovieCast,
    MovieCrew,
    Payment,
    Recommendation,
    Video,
    Chat,
    Wallet,
    WatchProvider,
    Feedback,
    SearchHistory,
    MoviePurchase,
    SystemSettingsEntity
  ],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')], // ✅ chỉ rõ đường dẫn tới migration
  synchronize: false, // ❗ phải là false khi dùng migration
  logging: true,
});

const migrationsDir = path.join(__dirname, '..', 'migrations');

if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir);
  console.log('📁 Found migration files:', files);
} else {
  console.error('❌ Migration directory not found:', migrationsDir);
}