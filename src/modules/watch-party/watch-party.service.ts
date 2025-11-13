import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TicketPurchase } from './entities/ticket-purchase.entity';
import { WatchPartyLog, WatchPartyEventType } from './entities/watch-party-log.entity';
import { CreateWatchPartyDto } from './dto/create-watch-party.dto';
import { UpdateWatchPartyDto } from './dto/update-watch-party.dto';
import { WatchPartyResponseDto } from './dto/watch-party-response.dto';
import type { User } from '../user/user.entity';
import { WatchParty, WatchPartyStatus } from './entities/watch-party.entity';
import { TicketService } from '../ticket/ticket.service';

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
  ) { }

  async create(createDto: CreateWatchPartyDto): Promise<WatchParty> {
    const {
      movie_id,
      start_time,
      end_time,
      is_featured,
      max_participants,
      ticket_price,
      ticket_description,
    } = createDto;

    const party = this.watchPartyRepository.create({
      movie: { id: movie_id } as any,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      is_featured: is_featured ?? false,
      max_participants: max_participants ?? 100,
    });

    const savedParty = await this.watchPartyRepository.save(party);

    savedParty.ticket = await this.ticketService.createForWatchParty(
      savedParty,
      ticket_price ?? WatchPartyService.DEFAULT_TICKET_PRICE,
      ticket_description,
    );

    return savedParty;
  }

  async findAll(status?: WatchPartyStatus, userId?: string): Promise<WatchPartyResponseDto[]> {
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

        return WatchPartyResponseDto.fromEntity(party, participantCount, hasPurchased);
      }),
    );
  }

  async findOne(id: string, userId?: string): Promise<WatchPartyResponseDto> {
    const party = await this.watchPartyRepository.findOne({
      where: { id },
      relations: ['movie', 'ticket', 'ticket_purchases', 'ticket_purchases.user'],
    });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    const participantCount = party.ticket_purchases?.length || 0;
    const participants = party.ticket_purchases?.map((p) => p.user) || [];
    const hasPurchased = userId
      ? party.ticket_purchases?.some((p) => p.user.id === userId)
      : undefined;

    return WatchPartyResponseDto.fromEntity(party, participantCount, hasPurchased, participants);
  }

  async update(id: string, updateDto: UpdateWatchPartyDto): Promise<WatchParty> {
    const party = await this.watchPartyRepository.findOne({ where: { id } });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    Object.assign(party, updateDto);
    return this.watchPartyRepository.save(party);
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