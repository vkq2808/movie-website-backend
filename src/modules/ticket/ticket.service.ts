import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '@/modules/watch-party/entities/ticket.entity';
import { WatchParty } from '@/modules/watch-party/entities/watch-party.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

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
}

