# Episode Server Module

## Overview
The Episode Server Module manages streaming servers for movie episodes.

## Components

### Entity (`episode-server.entity.ts`)
Core fields:
- `id`: UUID primary key
- `episode`: Relation to Episode entity
- `url`: Server streaming URL
- `created_at` & `updated_at`: Timestamps

### Controller (`episode-server.controller.ts`)
Handles server management requests.

### Service (`episode-server.service.ts`)
Implements:
- Server management
- URL validation
- Server health checks
- Load balancing support

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([EpisodeServer, Episode]),
  ],
  controllers: [EpisodeServerController],
  providers: [EpisodeServerService]
})
```

## Features
- Multiple server support
- Server health monitoring
- URL validation
- Load distribution
- Failover support

## Database Relations
- Many-to-One with Episode
- Uses TypeORM for database operations

## Security Features
- URL validation
- Server authentication
- Access control
- SSL/TLS support

## Health Checks
- Server availability
- Response time monitoring
- Error rate tracking
- Bandwidth monitoring
