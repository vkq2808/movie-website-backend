# Watch Party Module

## Overview
The Watch Party module enables synchronized movie watching experiences where multiple users can watch a movie together in real-time with chat functionality.

## Features
- **Scheduled Events**: Create watch parties with specific start and end times
- **Ticket System**: Users purchase tickets to join watch parties
- **Real-time Sync**: WebSocket-based video player synchronization
- **Live Chat**: Real-time messaging during watch parties
- **Event Logging**: All interactions are logged for replay functionality
- **Participant Management**: Track active participants and enforce max limits

## Entities

### WatchParty
- `id`: UUID
- `movie`: Relation to Movie entity
- `start_time`: Event start timestamp
- `end_time`: Event end timestamp
- `is_featured`: Featured event flag
- `max_participants`: Maximum allowed participants
- `status`: upcoming | ongoing | finished

### Ticket
- `id`: UUID
- `name`: Ticket name
- `price`: Ticket price
- `description`: Ticket description
- `is_voucher`: Voucher flag

### TicketPurchase
- `id`: UUID
- `user`: Relation to User
- `watch_party`: Relation to WatchParty
- `ticket`: Relation to Ticket
- `purchase_date`: Purchase timestamp

### WatchPartyLog
- `id`: UUID
- `watch_party`: Relation to WatchParty
- `user`: Relation to User
- `event_type`: message | join | leave | play | pause | seek
- `content`: JSONB event data
- `real_time`: Actual timestamp
- `event_time`: Seconds from event start

## API Endpoints

### REST API
- `GET /watch-parties` - List all watch parties (with optional status filter)
- `GET /watch-parties/:id` - Get watch party details
- `POST /watch-parties` - Create new watch party (admin)
- `PATCH /watch-parties/:id` - Update watch party (admin)
- `POST /watch-parties/:id/purchase` - Purchase ticket
- `GET /watch-parties/:id/logs` - Get event logs

### WebSocket Events (Namespace: /watch-party)

#### Client → Server
- `join_party` - Join watch party room
- `leave_party` - Leave watch party room
- `send_message` - Send chat message
- `player_action` - Video control (play/pause/seek)

#### Server → Client
- `user_joined` - Broadcast when user joins
- `user_left` - Broadcast when user leaves
- `new_message` - Broadcast chat message
- `sync_player` - Sync video state
- `participant_list` - Updated participant list

## Usage

### Creating a Watch Party
```typescript
POST /watch-parties
{
  "movie_id": "uuid",
  "start_time": "2025-01-15T20:00:00Z",
  "end_time": "2025-01-15T22:30:00Z",
  "is_featured": true,
  "max_participants": 100
}
```

### Purchasing a Ticket
```typescript
POST /watch-parties/:id/purchase
{
  "ticket_id": "uuid"
}
```

### WebSocket Connection
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/watch-party');

socket.emit('join_party', {
  partyId: 'uuid',
  userId: 'uuid',
  username: 'John Doe'
});

socket.on('new_message', (message) => {
  console.log(message);
});
```

## Status Management
The module includes automatic status updates:
- `upcoming` → `ongoing` when current time >= start_time
- `ongoing` → `finished` when current time >= end_time

This is handled by a scheduled task that runs periodically.

## Event Replay
All user interactions are logged with both:
- `real_time`: Actual timestamp when event occurred
- `event_time`: Seconds from party start time

This allows replaying the entire watch party experience after it ends, with chat messages appearing at the correct video timestamps.