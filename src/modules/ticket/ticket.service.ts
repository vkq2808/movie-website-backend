import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '@/modules/ticket/ticket.entity';
import { WatchParty } from '@/modules/watch-party/entities/watch-party.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) { }

  async createForWatchParty(
    watchParty: WatchParty,
    price: number,
    description?: string,
  ): Promise<Ticket> {
    const ticket = this.ticketRepository.create({
      watch_party: watchParty,
      price,
      description,
    });

    return this.ticketRepository.save(ticket);
  }

  async updateForWatchParty(
    watchParty: WatchParty,
    price?: number,
    description?: string,
  ): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { watch_party: { id: watchParty.id } },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found for this watch party');
    }

    if (price !== undefined) {
      ticket.price = price;
    }
    if (description !== undefined) {
      ticket.description = description;
    }

    return this.ticketRepository.save(ticket);
  }
}
