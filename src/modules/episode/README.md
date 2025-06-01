# Episode Module

## Overview
The Episode Module manages movie episodes and their streaming servers.

## Components

### Entities

#### Episode Entity (`episode.entity.ts`)
Core fields:
- `id`: UUID primary key
- `movie`: Relation to Movie entity
- `servers`: Many-to-many with EpisodeServer
- `title`: Episode title
- `description`: Episode description
- `duration`: Episode duration in minutes
- `created_at` & `updated_at`: Timestamps

#### EpisodeServer Entity (`episode-server.entity.ts`)
Core fields:
- `id`: UUID primary key
- `episode`: Relation to Episode
- `url`: Streaming server URL
- `created_at` & `updated_at`: Timestamps

### Controller (`episode.controller.ts`)
Handles episode-related HTTP requests.

### Service (`episode.service.ts`)
Implements:
- Episode CRUD operations
- Server management
- Episode metadata handling

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Episode, Movie, EpisodeServer]),
  ],
  controllers: [EpisodeController],
  providers: [EpisodeService]
})
```

## Features
- Episode management
- Multiple server support
- Duration tracking
- Server availability monitoring

## Database Relations
- Many-to-One with Movie
- Many-to-Many with EpisodeServer
- Uses TypeORM for database operations

## Input Validation
Uses class-validator for:
- Required fields validation
- URL validation for servers
- Duration validation
- String field validation

## Security
- JWT authentication required
- URL validation
- Server availability checks
