# Watch History Module

## Overview
The Watch History Module tracks and manages users' movie watching history.

## Components

### Entity (`watch-history.entity.ts`)
Core fields:
- `id`: UUID primary key
- `user`: Relation to User entity
- `movie`: Relation to Movie entity
- `watched_at`: Timestamp of viewing
- `watch_duration`: Duration watched
- `completed`: Completion status
- `created_at` & `updated_at`: Timestamps

### Controller (`watch-history.controller.ts`)
Handles watch history related requests.

### Service (`watch-history.service.ts`)
Implements:
- Watch history tracking
- Progress management
- History retrieval
- Analytics support

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([WatchHistory, User, Movie])
  ],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService]
})
```

## Features
- Watch progress tracking
- Viewing history management
- Resume functionality
- Watch time analytics
- Viewing patterns analysis

## Database Relations
- Many-to-One with User
- Many-to-One with Movie
- Uses TypeORM for database operations

## Use Cases
- Continue watching
- Viewing recommendations
- User preferences
- Usage analytics
- Content optimization

## Security Features
- User authentication required
- Privacy protection
- Data retention policies
- Access control

## Integration
- Movie Module
- User Module
- Analytics system
- Recommendation engine
