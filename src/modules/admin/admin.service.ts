import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { Genre } from '@/modules/genre/genre.entity';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { GenreService } from '../genre/genre.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,

    @InjectRepository(WatchHistory)
    private readonly watchRepo: Repository<WatchHistory>,

    private readonly genreService: GenreService
  ) { }

  async getStats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ----------- Tổng hợp số liệu chính -----------
    const [totalUsers, totalMovies, totalViews, newUsersThisWeek] = await Promise.all([
      this.userRepo.count(),
      this.movieRepo.count(),
      this.watchRepo.count(),
      this.userRepo.count({
        where: { created_at: MoreThan(sevenDaysAgo) },
      }),
    ]);

    // Kết quả: [{ genre: "Action", count: "35" }, { genre: "Drama", count: "28" }, ...]
    const genreDistribution = await this.genreService.getGenreTrending();

    // ----------- Top 10 phim được xem nhiều nhất -----------
    const mostWatchedMovies = await this.watchRepo
      .createQueryBuilder('watch')
      .leftJoin('watch.movie', 'movie')
      .select('movie.title', 'title')
      .addSelect('COUNT(watch.id)', 'views')
      .groupBy('movie.id')
      .orderBy('views', 'DESC')
      .limit(10)
      .getRawMany();

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

    // ============= F. Trạng thái hệ thống =============
    const system = this.getSystemStatus();

    // Chuẩn hóa kết quả trả về
    return {
      totalUsers,
      totalMovies,
      totalViews,
      newUsersThisWeek,
      genreDistribution,
      mostWatchedMovies,
      recentActivity,
      userGrowth,
      system,
    };
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
      let recentErrors: { id: string; message: string; timestamp: string }[] = [];

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
