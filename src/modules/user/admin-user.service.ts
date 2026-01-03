import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { AuthService } from '@/modules/auth/services/auth.service';
import { RedisService } from '@/modules/redis/redis.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { AuditAction } from '@/modules/audit-log/entities/audit-log.entity';
import { TokenPayload } from '@/common/token-payload.type';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getUserDetails(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: [
        'watch_histories',
        'movie_purchases',
        'payments',
        'feedbacks',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      is_verified: user.is_verified,
      is_banned: user.is_banned,
      banned_until: user.banned_until,
      ban_reason: user.ban_reason,
      created_at: user.created_at,
      watch_history: user.watch_histories || [],
      purchase_history: user.movie_purchases || [],
      payment_history: user.payments || [],
      feedbacks: user.feedbacks || [],
    };
  }

  async banUser(
    userId: string,
    reason: string,
    bannedUntil?: Date,
    actor?: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_banned = true;
    user.ban_reason = reason;
    user.banned_until = bannedUntil || undefined;
    user.is_active = false;

    await this.userRepo.save(user);

    // Force logout by blacklisting all tokens
    await this.forceLogout(userId);

    // Audit log
    await this.auditLogService.logAction(actor, AuditAction.USER_BAN, 'user', {
      resourceId: userId,
      description: `User ${user.email} banned. Reason: ${reason}`,
      metadata: { reason, banned_until: bannedUntil },
      ipAddress,
      userAgent,
    });

    return user;
  }

  async unbanUser(
    userId: string,
    actor?: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_banned = false;
    user.ban_reason = undefined;
    user.banned_until = undefined;
    user.is_active = true;

    await this.userRepo.save(user);

    // Audit log
    await this.auditLogService.logAction(
      actor,
      AuditAction.USER_UNBAN,
      'user',
      {
        resourceId: userId,
        description: `User ${user.email} unbanned`,
        ipAddress,
        userAgent,
      },
    );

    return user;
  }

  async forceLogout(userId: string) {
    // Blacklist all tokens for this user
    // In a production system, you'd track active tokens per user
    // For now, we'll use a pattern-based approach
    try {
      const keys = await this.redisService.keys(`token:*:${userId}`);
      for (const key of keys) {
        await this.redisService.del(key);
      }
    } catch (error) {
      console.error('Error force logging out user:', error);
    }
  }

  async resetPassword(
    userId: string,
    newPassword: string,
    actor?: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await this.userRepo.save(user);

    // Force logout after password reset
    await this.forceLogout(userId);

    // Audit log
    await this.auditLogService.logAction(
      actor,
      AuditAction.USER_RESET_PASSWORD,
      'user',
      {
        resourceId: userId,
        description: `Password reset for user ${user.email}`,
        ipAddress,
        userAgent,
      },
    );

    return { success: true };
  }

  async impersonate(
    targetUserId: string,
    adminUser: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const targetUser = await this.userRepo.findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.is_banned) {
      throw new Error('Cannot impersonate banned user');
    }

    // Generate impersonation token with special scope
    const impersonationToken = await this.authService.generateToken(targetUser);

    // Audit log
    await this.auditLogService.logAction(
      adminUser,
      AuditAction.USER_IMPERSONATE,
      'user',
      {
        resourceId: targetUserId,
        description: `Admin ${adminUser.email} impersonating user ${targetUser.email}`,
        metadata: { target_user_id: targetUserId },
        ipAddress,
        userAgent,
      },
    );

    return {
      token: impersonationToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        role: targetUser.role,
      },
    };
  }
}
