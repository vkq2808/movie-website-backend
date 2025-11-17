import type { WatchParty } from '../entities/watch-party.entity';
import type { User } from '@/modules/user/user.entity';

export class WatchPartyResponseDto {
  id: string;
  movie: any;
  start_time: Date;
  end_time: Date;
  is_featured: boolean;
  max_participants: number;
  status: string;
  participant_count: number;
  participants?: Partial<User>[];
  has_purchased?: boolean;
  ticket?: {
    id: string;
    price: number;
    description?: string;
  };
  created_at: Date;
  updated_at: Date;

  static fromEntity(
    party: WatchParty,
    participantCount: number,
    hasPurchased?: boolean,
    participants?: User[],
  ): WatchPartyResponseDto {
    return {
      id: party.id,
      movie: party.movie,
      start_time: party.start_time,
      end_time: party.end_time,
      is_featured: party.is_featured,
      max_participants: party.max_participants,
      status: party.status,
      participant_count: participantCount,
      participants: participants?.map((u) => ({
        id: u.id,
        username: u.username,
        avatar: u.photo_url,
      })),
      ticket: party.ticket
        ? {
            id: party.ticket.id,
            price: Number(party.ticket.price),
            description: party.ticket.description ?? undefined,
          }
        : undefined,
      has_purchased: hasPurchased,
      created_at: party.created_at,
      updated_at: party.updated_at,
    };
  }
}
