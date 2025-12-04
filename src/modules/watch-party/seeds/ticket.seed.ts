import { DataSource } from 'typeorm';
import { Ticket } from '../../ticket/ticket.entity';
import { WatchParty } from '../entities/watch-party.entity';

export async function seedTickets(dataSource: DataSource): Promise<void> {
  const ticketRepository = dataSource.getRepository(Ticket);
  const watchPartyRepository = dataSource.getRepository(WatchParty);

  const watchParties = await watchPartyRepository.find({
    relations: ['ticket', 'movie'],
  });

  for (const party of watchParties) {
    if (!party.ticket) {
      const ticket = ticketRepository.create({
        watch_party: party,
        price: 5000,
        description: `Ticket for watch party: ${party.movie?.title ?? party.id}`,
      });
      await ticketRepository.save(ticket);
      console.log(`Created ticket for watch party ${party.id}`);
    }
  }
}
