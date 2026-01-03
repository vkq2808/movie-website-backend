import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { TokenPayload } from '@/common/token-payload.type';

export interface CreateAuditLogDto {
  actor_id?: string;
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditLogRepo.create(dto);
    return this.auditLogRepo.save(log);
  }

  async logAction(
    user: TokenPayload | undefined,
    action: AuditAction,
    resourceType: string,
    options: {
      resourceId?: string;
      description?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    } = {},
  ): Promise<AuditLog> {
    return this.create({
      actor_id: user?.sub,
      action,
      resource_type: resourceType,
      resource_id: options.resourceId,
      description: options.description,
      metadata: options.metadata,
      ip_address: options.ipAddress,
      user_agent: options.userAgent,
    });
  }

  async findAll(filters: {
    action?: AuditAction;
    resource_type?: string;
    resource_id?: string;
    actor_id?: string;
    start_date?: Date;
    end_date?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, ...whereFilters } = filters;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<AuditLog> = {};
    if (whereFilters.action) where.action = whereFilters.action;
    if (whereFilters.resource_type)
      where.resource_type = whereFilters.resource_type;
    if (whereFilters.resource_id) where.resource_id = whereFilters.resource_id;
    if (whereFilters.actor_id) where.actor_id = whereFilters.actor_id;

    const [logs, total] = await this.auditLogRepo.findAndCount({
      where,
      relations: ['actor'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      logs,
      total,
      page,
      limit,
      hasMore: skip + logs.length < total,
    };
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.auditLogRepo.findOne({
      where: { id },
      relations: ['actor'],
    });
  }
}
