import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard, RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums';
import { GetCommentsQueryDto } from './feedback.dto';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Repository } from 'typeorm';
import { ResourcesNotFoundException } from '@/exceptions';

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminFeedbackController {
  private readonly logger = new Logger(AdminFeedbackController.name);

  constructor(
    private readonly feedbackService: FeedbackService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  /**
   * Get all feedbacks with pagination, search, and filter (Admin only)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 50)
   * @param search - Search by user name or movie title
   * @param status - Filter by feedback status (active, hidden, all)
   */
  @Get()
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getAllFeedbacks(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    try {
      const pageNum = page ? Math.max(parseInt(page), 1) : 1;
      const limitNum = Math.min(
        Math.max(limit ? parseInt(limit) : 10, 1),
        50,
      );
      const skip = (pageNum - 1) * limitNum;

      const [feedbacks, total] = await this.feedbackService.findAllPaginated(
        {
          skip,
          take: limitNum,
          search,
          status,
        },
      );

      return {
        success: true,
        data: {
          feedbacks,
          total,
          page: pageNum,
          limit: limitNum,
          hasMore: pageNum * limitNum < total,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get all feedbacks', error.stack);
      throw error;
    }
  }

  /**
   * Hide feedback (soft delete - marks as hidden but preserves data)
   * @param id - Feedback ID
   */
  @Post(':id/hide')
  @HttpCode(200)
  async hideFeedback(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    try {
      const feedback = await this.feedbackService.findById(id);
      if (!feedback) {
        throw new ResourcesNotFoundException('Feedback not found');
      }

      const updated = await this.feedbackService.updateStatus(id, 'hidden');
      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      this.logger.error(
        `Failed to hide feedback ${id}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Unhide feedback (restore from hidden state)
   * @param id - Feedback ID
   */
  @Post(':id/unhide')
  @HttpCode(200)
  async unhideFeedback(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    try {
      const feedback = await this.feedbackService.findById(id);
      if (!feedback) {
        throw new ResourcesNotFoundException('Feedback not found');
      }

      const updated = await this.feedbackService.updateStatus(id, 'active');
      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      this.logger.error(
        `Failed to unhide feedback ${id}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete feedback permanently (hard delete)
   * @param id - Feedback ID
   */
  @Delete(':id')
  @HttpCode(204)
  async deleteFeedback(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    try {
      const feedback = await this.feedbackService.findById(id);
      if (!feedback) {
        throw new ResourcesNotFoundException('Feedback not found');
      }

      await this.feedbackService.deleteByAdmin(id);
    } catch (error) {
      this.logger.error(
        `Failed to delete feedback ${id}`,
        error.stack,
      );
      throw error;
    }
  }
}
