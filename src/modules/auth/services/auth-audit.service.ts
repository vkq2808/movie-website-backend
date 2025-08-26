import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface AuthAuditLog {
  userId?: string;
  email?: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuthAuditService {
  constructor(private readonly redisService: RedisService) {}

  logAuthEvent(event: AuthAuditLog): void {
    try {
      // TODO: Implement Redis logging when needed
      // const logKey = `auth_audit:${new Date().toISOString().split('T')[0]}`;
      // const logEntry = JSON.stringify(event);

      // Store in Redis list with daily rotation
      // await this.redisService.getClient().lpush(logKey, logEntry);

      // // Set TTL for 30 days
      // await this.redisService.getClient().expire(logKey, 60 * 60 * 24 * 30);

      // // Keep only last 1000 entries per day
      // await this.redisService.getClient().ltrim(logKey, 0, 999);

      // Also log to console for immediate monitoring
      console.log('Auth Event:', event);
    } catch (error) {
      console.error('Failed to log auth event:', error);
    }
  }

  async getAuditLogs(
    date: string,
    limit: number = 100,
  ): Promise<AuthAuditLog[]> {
    try {
      const logKey = `auth_audit:${date}`;
      const logs = await this.redisService
        .getClient()
        .lrange(logKey, 0, limit - 1);
      return logs.map((log) => JSON.parse(log) as AuthAuditLog);
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }

  async getUserLoginHistory(
    userId: string,
    limit: number = 50,
  ): Promise<AuthAuditLog[]> {
    try {
      // This is a simplified implementation
      // In production, you might want to use a proper database for querying
      const today = new Date().toISOString().split('T')[0];
      const logs = await this.getAuditLogs(today, 1000);

      return logs
        .filter((log) => log.userId === userId && log.action === 'login')
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to retrieve user login history:', error);
      return [];
    }
  }

  logLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    userId?: string,
  ): void {
    this.logAuthEvent({
      userId,
      email,
      action: 'login',
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      success,
    });
  }

  logRegistration(
    email: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    userId?: string,
  ): void {
    this.logAuthEvent({
      userId,
      email,
      action: 'register',
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      success,
    });
  }

  logPasswordChange(
    userId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
  ): void {
    this.logAuthEvent({
      userId,
      action: 'password_change',
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      success,
    });
  }

  logLogout(userId: string, ipAddress: string, userAgent: string): void {
    this.logAuthEvent({
      userId,
      action: 'logout',
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      success: true,
    });
  }

  logAccountDeactivation(
    userId: string,
    ipAddress: string,
    userAgent: string,
    reason?: string,
  ): void {
    this.logAuthEvent({
      userId,
      action: 'account_deactivated',
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      success: true,
      details: { reason },
    });
  }
}
