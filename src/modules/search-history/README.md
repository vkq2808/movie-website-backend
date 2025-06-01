# Search History Module

## Overview
The Search History Module tracks and manages user search activities.

## Components

### Entity (`search-history.entity.ts`)
Core fields:
- `id`: UUID primary key
- `user`: Relation to User entity
- `query`: Search query text
- `created_at` & `updated_at`: Timestamps

### Controller (`search-history.controller.ts`)
Handles search history related requests.

### Service (`search-history.service.ts`)
Implements:
- Search history tracking
- History retrieval
- History management
- Analytics support

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([SearchHistory, User]),
  ],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService]
})
```

## Features
- Search query tracking
- User history management
- History analytics
- Personalized suggestions

## Database Relations
- Many-to-One with User entity
- Uses TypeORM for database operations

## Usage
- Track user search patterns
- Improve search suggestions
- Generate analytics
- Enhance user experience

## Security Features
- User authentication required
- Privacy protection
- Data retention policies
- Access control
