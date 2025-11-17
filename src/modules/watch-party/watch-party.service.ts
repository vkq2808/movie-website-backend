import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { TicketPurchase } from './entities/ticket-purchase.entity';
import {
  WatchPartyLog,
  WatchPartyEventType,
} from './entities/watch-party-log.entity';
import { CreateWatchPartyDto } from './dto/create-watch-party.dto';
import { UpdateWatchPartyDto } from './dto/update-watch-party.dto';
import { WatchPartyResponseDto } from './dto/watch-party-response.dto';
import type { User } from '../user/user.entity';
import { WatchParty, WatchPartyStatus } from './entities/watch-party.entity';
import { TicketService } from '../ticket/ticket.service';
import { FilterWatchPartyDto } from './dto/filter-watch-party.dto';
import { winstonLogger } from '@/common/logger/winston-logger';
import { TokenPayload } from '@/common';

@Injectable()
export class WatchPartyService {
  private static readonly DEFAULT_TICKET_PRICE = 5000;

  constructor(
    @InjectRepository(WatchParty)
    private watchPartyRepository: Repository<WatchParty>,
    @InjectRepository(TicketPurchase)
    private ticketPurchaseRepository: Repository<TicketPurchase>,
    @InjectRepository(WatchPartyLog)
    private watchPartyLogRepository: Repository<WatchPartyLog>,
    private readonly ticketService: TicketService,
  ) {}

  async create(createDto: CreateWatchPartyDto): Promise<WatchParty> {
    const {
      movie_id,
      start_time,
      end_time,
      is_featured,
      max_participants,
      ticket_price,
      ticket_description,
      recurrence,
    } = createDto;

    const party = this.watchPartyRepository.create({
      movie: { id: movie_id } as any,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      is_featured: is_featured ?? false,
      max_participants: max_participants ?? 100,
      recurrence,
    });

    const savedParty = await this.watchPartyRepository.save(party);

    savedParty.ticket = await this.ticketService.createForWatchParty(
      savedParty,
      ticket_price ?? WatchPartyService.DEFAULT_TICKET_PRICE,
      ticket_description,
    );

    return savedParty;
  }

  async findAll(
    status?: WatchPartyStatus,
    userId?: string,
  ): Promise<WatchPartyResponseDto[]> {
    const queryBuilder = this.watchPartyRepository
      .createQueryBuilder('party')
      .leftJoinAndSelect('party.movie', 'movie')
      .leftJoinAndSelect('party.ticket', 'ticket')
      .leftJoinAndSelect('party.ticket_purchases', 'purchases')
      .leftJoinAndSelect('purchases.user', 'user');

    if (status) {
      queryBuilder.where('party.status = :status', { status });
    }

    const parties = await queryBuilder.getMany();

    return Promise.all(
      parties.map(async (party) => {
        const participantCount = party.ticket_purchases?.length || 0;
        const hasPurchased = userId
          ? party.ticket_purchases?.some((p) => p.user.id === userId)
          : undefined;

        return WatchPartyResponseDto.fromEntity(
          party,
          participantCount,
          hasPurchased,
        );
      }),
    );
  }

  async findAllAdmin(
    filterDto: FilterWatchPartyDto,
  ): Promise<WatchPartyResponseDto[]> {
    const { movie_title, event_type, start_date, end_date, is_featured } =
      filterDto;
    const queryBuilder = this.watchPartyRepository
      .createQueryBuilder('party')
      .leftJoinAndSelect('party.movie', 'movie')
      .leftJoinAndSelect('party.ticket', 'ticket')
      .withDeleted();

    if (movie_title) {
      queryBuilder.andWhere('movie.title ILIKE :movie_title', {
        movie_title: `%${movie_title}%`,
      });
    }

    if (event_type) {
      // Assuming event_type corresponds to status
      queryBuilder.andWhere('party.status = :event_type', { event_type });
    }

    if (start_date) {
      queryBuilder.andWhere('party.start_time >= :start_date', { start_date });
    }

    if (end_date) {
      queryBuilder.andWhere('party.end_time <= :end_date', { end_date });
    }

    if (is_featured !== undefined) {
      queryBuilder.andWhere('party.is_featured = :is_featured', {
        is_featured,
      });
    }

    const parties = await queryBuilder.getMany();
    return Promise.all(
      parties.map(async (party) => {
        const participantCount = await this.ticketPurchaseRepository.count({
          where: { watch_party: { id: party.id } },
        });
        return WatchPartyResponseDto.fromEntity(party, participantCount);
      }),
    );
  }

  async findOne(id: string, userId?: string): Promise<WatchPartyResponseDto> {
    const party = await this.watchPartyRepository.findOne({
      where: { id },
      relations: [
        'movie',
        'ticket',
        'ticket_purchases',
        'ticket_purchases.user',
      ],
    });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    const participantCount = party.ticket_purchases?.length || 0;
    const participants = party.ticket_purchases?.map((p) => p.user) || [];
    const hasPurchased = userId
      ? party.ticket_purchases?.some((p) => p.user.id === userId)
      : undefined;

    return WatchPartyResponseDto.fromEntity(
      party,
      participantCount,
      hasPurchased,
      participants,
    );
  }

  async findOneAdmin(id: string): Promise<WatchPartyResponseDto> {
    const party = await this.watchPartyRepository.findOne({
      where: { id },
      relations: [
        'movie',
        'ticket',
        'ticket_purchases',
        'ticket_purchases.user',
      ],
      withDeleted: true,
    });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    const participantCount = party.ticket_purchases?.length || 0;
    const participants = party.ticket_purchases?.map((p) => p.user) || [];

    return WatchPartyResponseDto.fromEntity(
      party,
      participantCount,
      false,
      participants,
    );
  }

  async update(
    id: string,
    updateDto: UpdateWatchPartyDto,
    user: TokenPayload,
    updateType: 'single' | 'series' = 'single',
  ): Promise<WatchParty> {
    const party = await this.watchPartyRepository.findOne({
      where: { id },
      relations: ['series', 'ticket'],
    });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    if (new Date(party.start_time) < new Date()) {
      throw new BadRequestException('Cannot edit a past event.');
    }

    if (updateType === 'series' && party.recurrence) {
      const occurrences = await this.watchPartyRepository.find({
        where: { series_id: id, start_time: MoreThan(new Date()) },
      });
      for (const occurrence of occurrences) {
        Object.assign(occurrence, updateDto);
        await this.watchPartyRepository.save(occurrence);
      }
    } else if (updateType === 'single' && party.series_id) {
      // Detach from series
      const newParty = this.watchPartyRepository.create({
        ...party,
        ...updateDto,
      });
      const savedParty = await this.watchPartyRepository.save(newParty);
      await this.watchPartyRepository.softRemove(party);
      winstonLogger.info(
        `Admin ${user.email} detached watch party ${party.id} from series and created ${savedParty.id}.`,
      );
      return savedParty;
    }

    Object.assign(party, updateDto);

    if (updateDto.ticket_price || updateDto.ticket_description) {
      await this.ticketService.updateForWatchParty(
        party,
        updateDto.ticket_price,
        updateDto.ticket_description,
      );
    }

    winstonLogger.info(`Admin ${user.email} updated watch party ${party.id}.`);
    return this.watchPartyRepository.save(party);
  }

  async remove(
    id: string,
    deleteType: 'single' | 'series' = 'single',
    user: TokenPayload,
  ): Promise<void> {
    const party = await this.watchPartyRepository.findOne({ where: { id } });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    if (deleteType === 'series' && party.recurrence) {
      const occurrences = await this.watchPartyRepository.find({
        where: { series_id: id, start_time: MoreThan(new Date()) },
      });
      await this.watchPartyRepository.softRemove(occurrences);
      winstonLogger.info(
        `Admin ${user.email} deleted future occurrences of watch party series ${id}.`,
      );
    }

    await this.watchPartyRepository.softRemove(party);
    winstonLogger.info(`Admin ${user.email} deleted watch party ${id}.`);
  }

  async canJoinParty(partyId: string, userId: string): Promise<boolean> {
    const purchase = await this.ticketPurchaseRepository.findOne({
      where: {
        user: { id: userId },
        watch_party: { id: partyId },
      },
      relations: ['ticket'],
    });

    return !!purchase;
  }

  async logEvent(
    partyId: string,
    userId: string | null,
    eventType: WatchPartyEventType,
    content: any,
    eventTime: number,
  ): Promise<WatchPartyLog> {
    const logData: Partial<WatchPartyLog> = {
      watch_party: { id: partyId } as WatchParty,
      event_type: eventType,
      content,
      real_time: new Date(),
      event_time: eventTime,
    };

    if (userId) {
      logData.user = { id: userId } as User;
    }

    const log = this.watchPartyLogRepository.create(logData);
    return this.watchPartyLogRepository.save(log);
  }

  async getEventLogs(partyId: string): Promise<WatchPartyLog[]> {
    return this.watchPartyLogRepository.find({
      where: { watch_party: { id: partyId } },
      order: { event_time: 'ASC' },
    });
  }

  async updatePartyStatus(): Promise<void> {
    const now = new Date();

    // Update to ongoing
    await this.watchPartyRepository.update(
      {
        status: WatchPartyStatus.UPCOMING,
        start_time: LessThan(now),
      },
      { status: WatchPartyStatus.ONGOING },
    );

    // Update to finished
    await this.watchPartyRepository.update(
      {
        status: WatchPartyStatus.ONGOING,
        end_time: LessThan(now),
      },
      { status: WatchPartyStatus.FINISHED },
    );
  }
}
