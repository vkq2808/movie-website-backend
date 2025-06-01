# Chat Module

## Overview
The Chat Module manages real-time communication between users in the platform.

## Components

### Entity (`chat.entity.ts`)
Core fields:
- `id`: UUID primary key
- `sender`: Relation to User entity
- `message`: Chat message content
- `created_at`: Message timestamp
- `updated_at`: Last update timestamp

### Controller (`chat.controller.ts`)
Handles chat-related HTTP requests and WebSocket events.

### Service (`chat.service.ts`)
Implements:
- Message handling
- Chat history management
- User chat operations

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Chat])
  ],
  controllers: [ChatController],
  providers: [ChatService]
})
```

## Features
- Real-time messaging
- Message history
- User-to-user communication

## Database Relations
- One-to-Many relationship with User entity (sender)
- Uses TypeORM for database operations

## Security
- JWT authentication required
- Message validation
- Rate limiting for message sending
