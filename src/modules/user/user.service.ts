import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { User } from '@/modules/user/user.entity';
import { Role } from '@/common/enums/role.enum';
import { AdminListUsersQueryDto, AdminUpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  async findById(id: string) {
    return this.userRepo.findOneBy({ id });
  }

  async listUsers(query: AdminListUsersQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> = {};
    if (query.search) {
      where.username = ILike(`%${query.search}%`);
    }
    if (query.role && query.role !== 'all') {
      where.role = query.role === 'admin' ? Role.Admin : Role.Customer;
    }
    if (query.status && query.status !== 'all') {
      where.is_active = query.status === 'active';
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    const mapped = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role === Role.Admin ? 'admin' : 'user',
      status: u.is_active ? 'active' : 'inactive',
      created_at: u.created_at?.toISOString?.() ?? String(u.created_at),
      last_login: undefined,
      avatar_url: u.photo_url ?? undefined,
      total_purchases: 0,
      total_watch_time: 0,
    }));

    return {
      users: mapped,
      total,
      page,
      limit,
      hasMore: total > skip + mapped.length,
    };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new Error('User not found');
    if (dto.role) {
      user.role = dto.role === 'admin' ? Role.Admin : Role.Customer;
    }
    if (dto.status) {
      user.is_active = dto.status === 'active';
    }
    await this.userRepo.save(user);
    return user;
  }

  async deleteUser(id: string) {
    await this.userRepo.delete({ id });
    return { success: true };
  }
}
