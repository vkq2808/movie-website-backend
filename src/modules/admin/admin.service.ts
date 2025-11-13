import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';
import { Genre } from '@/modules/genre/genre.entity';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { GenreService } from '../genre/genre.service';
import { WatchPartyService } from '../watch-party/watch-party.service';
import { WatchParty } from '../watch-party/entities/watch-party.entity';
import { CreateAdminWatchPartyDto, EventType, RecurrenceType } from './dto/create-admin-watch-party.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,

    @InjectRepository(WatchHistory)
    private readonly watchRepo: Repository<WatchHistory>,

    private readonly genreService: GenreService,
    private readonly watchPartyService: WatchPartyService,
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

  async createWatchParty(dto: CreateAdminWatchPartyDto): Promise<WatchParty | WatchParty[]> {
    // Validate movie exists and has runtime
    const movie = await this.movieRepo.findOne({ where: { id: dto.movie_id } });
    if (!movie) {
      throw new NotFoundException(`Movie with ID ${dto.movie_id} not found`);
    }
    if (!movie.runtime || movie.runtime <= 0) {
      movie.runtime = 1200;
      // throw new BadRequestException('Movie must have a valid runtime (in minutes)');
    }

    const runtimeMinutes = movie.runtime;
    const maxParticipants = dto.max_participants ?? 100;
    const isFeatured = dto.is_featured ?? false;

    // Handle different event types
    if (dto.event_type === EventType.RANDOM) {
      // Random: start immediately
      const now = new Date();
      const endTime = new Date(now.getTime() + runtimeMinutes * 60 * 1000);

      return this.watchPartyService.create({
        movie_id: dto.movie_id,
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
        max_participants: maxParticipants,
        is_featured: isFeatured,
        ticket_price: dto.ticket_price,
        ticket_description: dto.ticket_description ?? `Ticket for watch party: ${movie.title}`,
      });
    } else if (dto.event_type === EventType.SCHEDULED) {
      // Scheduled: one-time event
      if (!dto.scheduled_start_time) {
        throw new BadRequestException('Scheduled start time is required for scheduled events');
      }

      const startTime = new Date(dto.scheduled_start_time);
      const now = new Date();
      if (startTime <= now) {
        throw new BadRequestException('Scheduled start time must be in the future');
      }

      const endTime = new Date(startTime.getTime() + runtimeMinutes * 60 * 1000);

      return this.watchPartyService.create({
        movie_id: dto.movie_id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        max_participants: maxParticipants,
        is_featured: isFeatured,
        ticket_price: dto.ticket_price,
        ticket_description: dto.ticket_description ?? `Ticket for watch party: ${movie.title}`,
      });
    } else if (dto.event_type === EventType.RECURRING) {
      // Recurring: multiple events
      if (!dto.scheduled_start_time) {
        throw new BadRequestException('Scheduled start time is required for recurring events');
      }
      if (!dto.recurrence_type) {
        throw new BadRequestException('Recurrence type is required for recurring events');
      }
      if (!dto.recurrence_end_date && !dto.recurrence_count) {
        throw new BadRequestException('Either recurrence end date or recurrence count is required for recurring events');
      }
      if (dto.recurrence_end_date && dto.recurrence_count) {
        throw new BadRequestException('Cannot specify both recurrence end date and recurrence count');
      }

      const startTime = new Date(dto.scheduled_start_time);
      const now = new Date();
      if (startTime <= now) {
        throw new BadRequestException('Scheduled start time must be in the future');
      }

      // Generate occurrence dates
      const occurrences = this.generateRecurrenceDates(
        startTime,
        dto.recurrence_type,
        dto.recurrence_end_date ? new Date(dto.recurrence_end_date) : null,
        dto.recurrence_count ?? null,
      );

      if (occurrences.length === 0) {
        throw new BadRequestException('No valid occurrences generated for recurring event');
      }

      // Create all events
      const events = await Promise.all(
        occurrences.map((occurrenceStart) => {
          const occurrenceEnd = new Date(occurrenceStart.getTime() + runtimeMinutes * 60 * 1000);
          return this.watchPartyService.create({
            movie_id: dto.movie_id,
            start_time: occurrenceStart.toISOString(),
            end_time: occurrenceEnd.toISOString(),
            max_participants: maxParticipants,
            is_featured: isFeatured,
            ticket_price: dto.ticket_price,
            ticket_description: dto.ticket_description ?? `Ticket for watch party: ${movie.title}`,
          });
        }),
      );

      return events;
    } else {
      throw new BadRequestException(`Invalid event type: ${dto.event_type}`);
    }
  }

  private generateRecurrenceDates(
    startDate: Date,
    recurrenceType: RecurrenceType,
    endDate: Date | null,
    maxCount: number | null,
  ): Date[] {
    const occurrences: Date[] = [];
    let currentDate = new Date(startDate);

    // Validate end date if provided
    if (endDate && endDate <= startDate) {
      throw new BadRequestException('Recurrence end date must be after scheduled start time');
    }

    // Generate occurrences
    while (true) {
      // Check if we've exceeded max count
      if (maxCount !== null && occurrences.length >= maxCount) {
        break;
      }

      // Check if we've exceeded end date
      if (endDate && currentDate > endDate) {
        break;
      }

      // Add current occurrence
      occurrences.push(new Date(currentDate));

      // Calculate next occurrence
      switch (recurrenceType) {
        case RecurrenceType.DAILY:
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case RecurrenceType.WEEKLY:
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case RecurrenceType.MONTHLY:
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
          // Handle month-end edge cases (e.g., Jan 31 -> Feb 28/29)
          if (currentDate.getDate() !== startDate.getDate()) {
            currentDate.setDate(0); // Go to last day of previous month
            currentDate.setDate(startDate.getDate());
          }
          break;
      }

      // Safety limit to prevent infinite loops
      if (occurrences.length >= 365) {
        break;
      }
    }

    return occurrences;
  }
}
