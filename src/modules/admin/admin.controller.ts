import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums/role.enum';
import { ResponseUtil } from '@/common/utils/response.util';
import { User } from '@/modules/auth/user.entity';
import { Movie } from '@/modules/movie/entities/movie.entity';
import { WatchHistory } from '@/modules/watch-history/watch-history.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(WatchHistory)
    private readonly watchRepo: Repository<WatchHistory>,
  ) {}

  @Get('stats')
  async getStats() {
    const [totalUsers, totalMovies, totalViews, newUsersThisWeek] =
      await Promise.all([
        this.userRepo.count(),
        this.movieRepo.count(),
        this.watchRepo.count(),
        this.userRepo
          .count({
            where: {
              created_at: (() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                return d;
              })(),
            },
          })
          .catch(() => 0),
      ]);

    return ResponseUtil.success(
      {
        totalUsers,
        totalMovies,
        totalViews,
        newUsersThisWeek,
        recentActivity: [],
        userGrowth: [],
        genreDistribution: [],
        mostWatchedMovies: [],
      },
      'Admin stats retrieved',
    );
  }
}
