import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketPurchase } from '@/modules/watch-party/entities/ticket-purchase.entity';
import { Ticket } from '@/modules/watch-party/entities/ticket.entity';
import {
  WatchParty,
  WatchPartyStatus,
} from '@/modules/watch-party/entities/watch-party.entity';
import { PurchaseTicketDto } from '@/modules/watch-party/dto/purchase-ticket.dto';
import type { User } from '@/modules/user/user.entity';

@Injectable()
export class TicketPurchaseService {
  constructor(
    @InjectRepository(TicketPurchase)
    private readonly ticketPurchaseRepository: Repository<TicketPurchase>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(WatchParty)
    private readonly watchPartyRepository: Repository<WatchParty>,
  ) {}

  async purchaseTicket(
    watchPartyId: string,
    userId: string,
    purchaseDto: PurchaseTicketDto,
  ): Promise<TicketPurchase> {
    if (!userId) {
      throw new UnauthorizedException(
        'Authentication required to purchase ticket',
      );
    }

    const party = await this.watchPartyRepository.findOne({
      where: { id: watchPartyId },
      relations: ['ticket', 'ticket_purchases'],
    });

    if (!party) {
      throw new NotFoundException('Watch party not found');
    }

    if (party.status === WatchPartyStatus.FINISHED) {
      throw new BadRequestException(
        'Cannot purchase ticket for finished event',
      );
    }

    const existingPurchase = await this.ticketPurchaseRepository.findOne({
      where: {
        user: { id: userId },
        watch_party: { id: watchPartyId },
      },
    });

    if (existingPurchase) {
      throw new BadRequestException('Already purchased ticket for this event');
    }

    if (
      party.ticket_purchases &&
      party.ticket_purchases.length >= party.max_participants
    ) {
      throw new BadRequestException('Event is full');
    }

    let ticket: Ticket | null = null;

    if (purchaseDto.ticket_id) {
      ticket = await this.ticketRepository.findOne({
        where: { id: purchaseDto.ticket_id },
        relations: ['watch_party'],
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.watch_party?.id !== party.id) {
        throw new BadRequestException(
          'Ticket does not belong to this watch party',
        );
      }
    } else if (party.ticket) {
      ticket = party.ticket;
    }

    if (!ticket) {
      throw new NotFoundException('Ticket not available for this watch party');
    }

    const purchase = this.ticketPurchaseRepository.create({
      user: { id: userId } as User,
      watch_party: party,
      ticket,
    });

    return this.ticketPurchaseRepository.save(purchase);
  }

  async getUserPurchases(userId: string): Promise<TicketPurchase[]> {
    return this.ticketPurchaseRepository.find({
      where: {
        user: { id: userId },
      },
      relations: [
        'ticket',
        'watch_party',
        'watch_party.movie',
        'watch_party.ticket',
        'watch_party.ticket_purchases',
        'watch_party.ticket_purchases.user',
      ],
      order: { created_at: 'DESC' },
    });
  }
}
