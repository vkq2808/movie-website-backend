import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  ModerationCase,
  ModerationStatus,
  ModerationResolution,
} from './entities/moderation-case.entity';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ModerationCase)
    private readonly moderationCaseRepo: Repository<ModerationCase>,
  ) {}

  async create(data: {
    report_id?: string;
    feedback_id?: string;
    assigned_moderator_id?: string;
  }): Promise<ModerationCase> {
    const case_ = this.moderationCaseRepo.create(data);
    return this.moderationCaseRepo.save(case_);
  }

  async findAll(filters: {
    status?: ModerationStatus;
    assigned_moderator_id?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, ...whereFilters } = filters;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ModerationCase> = {};
    if (whereFilters.status) where.status = whereFilters.status;
    if (whereFilters.assigned_moderator_id)
      where.assigned_moderator_id = whereFilters.assigned_moderator_id;

    const [cases, total] = await this.moderationCaseRepo.findAndCount({
      where,
      relations: [
        'report',
        'feedback',
        'assigned_moderator',
        'report.reporter',
        'feedback.user',
      ],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      cases,
      total,
      page,
      limit,
      hasMore: skip + cases.length < total,
    };
  }

  async findById(id: string): Promise<ModerationCase | null> {
    return this.moderationCaseRepo.findOne({
      where: { id },
      relations: [
        'report',
        'feedback',
        'assigned_moderator',
        'report.reporter',
        'feedback.user',
      ],
    });
  }

  async updateStatus(
    id: string,
    status: ModerationStatus,
    moderatorNotes?: string,
  ): Promise<ModerationCase> {
    const case_ = await this.findById(id);
    if (!case_) throw new Error('Moderation case not found');

    case_.status = status;
    if (moderatorNotes) case_.moderator_notes = moderatorNotes;

    return this.moderationCaseRepo.save(case_);
  }

  async assignModerator(
    id: string,
    moderatorId: string,
  ): Promise<ModerationCase> {
    const case_ = await this.findById(id);
    if (!case_) throw new Error('Moderation case not found');

    case_.assigned_moderator_id = moderatorId;
    if (case_.status === ModerationStatus.NEW) {
      case_.status = ModerationStatus.IN_PROGRESS;
    }

    return this.moderationCaseRepo.save(case_);
  }

  async resolve(
    id: string,
    resolution: ModerationResolution,
    resolutionNotes?: string,
  ): Promise<ModerationCase> {
    const case_ = await this.findById(id);
    if (!case_) throw new Error('Moderation case not found');

    case_.status = ModerationStatus.RESOLVED;
    case_.resolution = resolution;
    case_.resolution_notes = resolutionNotes;
    case_.resolved_at = new Date();

    return this.moderationCaseRepo.save(case_);
  }

  async reject(
    id: string,
    resolutionNotes?: string,
  ): Promise<ModerationCase> {
    const case_ = await this.findById(id);
    if (!case_) throw new Error('Moderation case not found');

    case_.status = ModerationStatus.REJECTED;
    case_.resolution = ModerationResolution.FALSE_REPORT;
    case_.resolution_notes = resolutionNotes;
    case_.resolved_at = new Date();

    return this.moderationCaseRepo.save(case_);
  }
}

