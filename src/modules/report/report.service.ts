import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Report, ReportStatus, ReportType } from './entities/report.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
  ) {}

  async create(data: {
    reporter_id: string;
    type: ReportType;
    reason: string;
    feedback_id?: string;
    movie_id?: string;
    reported_user_id?: string;
  }): Promise<Report> {
    const report = this.reportRepo.create(data);
    return this.reportRepo.save(report);
  }

  async findAll(filters: {
    status?: ReportStatus;
    type?: ReportType;
    reporter_id?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, ...whereFilters } = filters;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Report> = {};
    if (whereFilters.status) where.status = whereFilters.status;
    if (whereFilters.type) where.type = whereFilters.type;
    if (whereFilters.reporter_id) where.reporter_id = whereFilters.reporter_id;

    const [reports, total] = await this.reportRepo.findAndCount({
      where,
      relations: ['reporter', 'feedback', 'movie', 'reported_user', 'assigned_moderator'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      reports,
      total,
      page,
      limit,
      hasMore: skip + reports.length < total,
    };
  }

  async findById(id: string): Promise<Report | null> {
    return this.reportRepo.findOne({
      where: { id },
      relations: ['reporter', 'feedback', 'movie', 'reported_user', 'assigned_moderator'],
    });
  }

  async updateStatus(
    id: string,
    status: ReportStatus,
    adminNotes?: string,
  ): Promise<Report> {
    const report = await this.findById(id);
    if (!report) throw new Error('Report not found');

    report.status = status;
    if (adminNotes) report.admin_notes = adminNotes;

    return this.reportRepo.save(report);
  }

  async assignModerator(
    id: string,
    moderatorId: string,
  ): Promise<Report> {
    const report = await this.findById(id);
    if (!report) throw new Error('Report not found');

    report.assigned_moderator_id = moderatorId;
    if (report.status === ReportStatus.NEW) {
      report.status = ReportStatus.IN_PROGRESS;
    }

    return this.reportRepo.save(report);
  }
}

