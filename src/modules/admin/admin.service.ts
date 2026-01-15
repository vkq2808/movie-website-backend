import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual, Between } from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { Payment } from '@/modules/payment/payment.entity';
import { MoviePurchase } from '@/modules/movie-purchase/movie-purchase.entity';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { GenreService } from '../genre/genre.service';
import { WatchPartyService } from '../watch-party/watch-party.service';
import { RedisService } from '@/modules/redis/redis.service';
import { enums } from '@/common';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,

    @InjectRepository(WatchHistory)
    private readonly watchRepo: Repository<WatchHistory>,

    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(MoviePurchase)
    private readonly purchaseRepo: Repository<MoviePurchase>,

    private readonly genreService: GenreService,
    private readonly watchPartyService: WatchPartyService,
    private readonly redisService: RedisService,
  ) { }

  async getStats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // ----------- Tổng hợp số liệu chính -----------
    const [
      totalUsers,
      totalMovies,
      totalViews,
      newUsersThisWeek,
      viewsToday,
      viewsThisMonth,
    ] = await Promise.all([
      this.userRepo.count(),
      this.movieRepo.count(),
      this.watchRepo.sum('view_count'),
      this.userRepo.count({
        where: { created_at: MoreThan(sevenDaysAgo) },
      }),
      this.watchRepo.sum('view_count', {
        created_at: MoreThan(today)
      }),
      this.watchRepo.sum('view_count', {
        created_at: MoreThan(thisMonth)
      }),
    ]);

    // Kết quả: [{ genre: "Action", count: "35" }, { genre: "Drama", count: "28" }, ...]
    const genreDistribution = await this.genreService.getGenreTrending();

    // ----------- Top 10 phim được xem nhiều nhất -----------
    const mostWatchedMoviesRaw = await this.watchRepo
      .createQueryBuilder('watch')
      .leftJoin('watch.movie', 'movie')
      .select('movie.id', 'id')
      .addSelect('movie.title', 'title')
      .addSelect('COUNT(watch.id)', 'views')
      .addSelect('movie.posters', 'posters')
      .groupBy('movie.id')
      .orderBy('views', 'DESC')
      .limit(10)
      .getRawMany();

    const mostWatchedMovies = mostWatchedMoviesRaw.map((m) => ({
      id: m.id,
      title: m.title,
      views: parseInt(m.views, 10),
      thumbnail: m.posters?.[0]?.url || '',
    }));

    // ----------- Revenue metrics -----------
    const revenueToday = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.payment_status = :status', {
        status: enums.PaymentStatus.Success,
      })
      .andWhere('payment.created_at >= :today', { today })
      .getRawOne();

    const revenueThisMonth = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.payment_status = :status', {
        status: enums.PaymentStatus.Success,
      })
      .andWhere('payment.created_at >= :thisMonth', { thisMonth })
      .getRawOne();

    const revenueLast7Days = await this.paymentRepo
      .createQueryBuilder('payment')
      .select("DATE_TRUNC('day', payment.created_at)", 'date')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'revenue')
      .where('payment.payment_status = :status', {
        status: enums.PaymentStatus.Success,
      })
      .andWhere('payment.created_at >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy("DATE_TRUNC('day', payment.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    // ----------- User online (approximate via Redis active sessions) -----------
    const userOnlineCount = await this.getUserOnlineCount();

    // ----------- API Error Rate (from logs) -----------
    const errorRate = await this.getErrorRate();

    // ----------- Hoạt động gần đây -----------
    const [recentUsers, recentMovies] = await Promise.all([
      this.userRepo.find({ order: { created_at: 'DESC' }, take: 5 }),
      this.movieRepo.find({ order: { created_at: 'DESC' }, take: 5 }),
    ]);

    const recentActivity = [
      ...recentUsers.map((u) => ({
        id: `user-${u.id}`,
        type: 'User Signup',
        description: `User ${u.email} registered`,
        timestamp: u.created_at,
      })),
      ...recentMovies.map((m) => ({
        id: `movie-${m.id}`,
        type: 'Movie Added',
        description: `Movie "${m.title}" was added`,
        timestamp: m.created_at,
      })),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);

    // ----------- Tăng trưởng người dùng (7 ngày gần nhất) -----------
    const userGrowth = await this.userRepo
      .createQueryBuilder('user')
      .select("DATE_TRUNC('day', user.created_at)", 'date')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.created_at >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy("DATE_TRUNC('day', user.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    // ----------- View trends (7 days) -----------
    const viewTrends = await this.watchRepo
      .createQueryBuilder('watch')
      .select("DATE_TRUNC('day', watch.created_at)", 'date')
      .addSelect('COUNT(watch.id)', 'views')
      .where('watch.created_at >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy("DATE_TRUNC('day', watch.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    // ============= F. Trạng thái hệ thống =============
    const system = this.getSystemStatus();

    // Chuẩn hóa kết quả trả về
    return {
      totalUsers,
      totalMovies,
      totalViews,
      newUsersThisWeek,
      viewsToday,
      viewsThisMonth,
      genreDistribution,
      mostWatchedMovies,
      recentActivity,
      userGrowth,
      viewTrends: viewTrends.map((v) => ({
        date: new Date(v.date).toISOString().split('T')[0],
        views: parseInt(v.views, 10),
      })),
      revenue: {
        today: parseFloat(revenueToday?.total || '0'),
        thisMonth: parseFloat(revenueThisMonth?.total || '0'),
        last7Days: revenueLast7Days.map((r) => ({
          date: new Date(r.date).toISOString().split('T')[0],
          revenue: parseFloat(r.revenue || '0'),
        })),
      },
      userOnline: userOnlineCount,
      errorRate,
      system,
    };
  }

  private async getUserOnlineCount(): Promise<number> {
    try {
      // Approximate: count active JWT tokens in Redis (if stored)
      // For now, return active users in last 15 minutes
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
      return await this.userRepo.count({
        where: { updated_at: MoreThan(fifteenMinutesAgo) },
      });
    } catch {
      return 0;
    }
  }

  private async getErrorRate(): Promise<{
    rate: number;
    totalRequests: number;
    errorRequests: number;
  }> {
    try {
      const logPath = './logs/combined.log';
      if (!existsSync(logPath)) {
        return { rate: 0, totalRequests: 0, errorRequests: 0 };
      }

      const logContent = readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((l) => l.trim() !== '');
      const last24Hours = lines.slice(-1000); // Last 1000 lines

      const errorLines = last24Hours.filter((line) =>
        /error|ERROR|500|400|401|403|404/.test(line),
      );

      return {
        rate:
          last24Hours.length > 0 ? errorLines.length / last24Hours.length : 0,
        totalRequests: last24Hours.length,
        errorRequests: errorLines.length,
      };
    } catch {
      return { rate: 0, totalRequests: 0, errorRequests: 0 };
    }
  }

  private getSystemStatus() {
    try {
      // 1️⃣ Lấy thông tin ổ đĩa bằng lệnh `df`
      const dfOutput = execSync('df -k /').toString();
      const lines = dfOutput.split('\n');
      const parts = lines[1].split(/\s+/);
      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);

      const totalGB = Math.round(totalKB / 1024 / 1024);
      const usedGB = Math.round(usedKB / 1024 / 1024);

      // 2️⃣ Đếm số server đang chạy (mock 1 hoặc dùng pm2 list)
      const activeServers = 1; // nếu bạn deploy cluster hoặc PM2, có thể lấy thực tế bằng `pm2 jlist`

      // 3️⃣ Đọc log lỗi gần đây
      const logPath = './logs/error.log';
      let recentErrors: { id: string; message: string; timestamp: string }[] =
        [];

      if (existsSync(logPath)) {
        const logContent = readFileSync(logPath, 'utf-8');
        const lines = logContent.split('\n').filter((l) => l.trim() !== '');
        recentErrors = lines
          .slice(-5)
          .map((line, i) => ({
            id: `err-${i}`,
            message: line.slice(0, 200),
            timestamp: new Date().toISOString(),
          }))
          .reverse();
      }

      return {
        storageUsedGB: usedGB,
        totalStorageGB: totalGB,
        activeServers,
        recentErrors,
      };
    } catch (error) {
      console.error('Failed to get system info:', error);
      return {
        storageUsedGB: 0,
        totalStorageGB: 0,
        activeServers: 0,
        recentErrors: [],
      };
    }
  }
}
