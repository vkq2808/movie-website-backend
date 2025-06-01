# Video Module

## Overview
The Video Module manages video content and streaming functionality.

## Components

### Entity (`video.entity.ts`)
Core fields:
- `id`: UUID primary key
- `movie`: Relation to Movie entity
- `iso_649_1`: Language code
- `iso_3166_1`: Country code
- `name`: Video name
- `key`: Video identifier
- `site`: Hosting platform
- `size`: Video quality
- `type`: Video type
- `official`: Official content flag
- `published_at`: Publication date

### Controller (`video.controller.ts`)
Handles video-related requests.

### Service (`video.service.ts`)
Implements:
- Video management
- Streaming handlers
- Video metadata
- Format handling

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Video, Movie]),
  ],
  controllers: [VideoController],
  providers: [VideoService]
})
```

## Features
- Video streaming
- Multiple quality support
- Multiple format support
- Language tracks
- Metadata management

## Database Relations
- Many-to-One with Movie
- Uses TypeORM for database operations

## Video Types
- Trailers
- Teasers
- Clips
- Behind the Scenes
- Bloopers
- Featurettes

## Streaming Features
- Adaptive bitrate
- Multiple resolutions
- Format conversion
- Stream monitoring
- Error handling

## Security
- Content protection
- Access control
- Geographic restrictions
- Copyright management
