# Image Module

## Overview
The Image Module manages image resources throughout the application.

## Components

### Entity (`image.entity.ts`)
Core fields:
- `id`: UUID primary key
- `resourceType`: Enum (IMAGE, RAW, VIDEO, AUTO)
- `url`: Image URL
- `publicId`: Public identifier for cloud storage
- `created_at` & `updated_at`: Timestamps

### Service
Provides image handling capabilities:
- Image upload
- Image retrieval
- Image deletion
- Format conversion

## Module Configuration
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Image])
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule]
})
```

## Features
- Multiple image type support
- Cloud storage integration
- Image optimization
- Format conversion
- URL management

## Usage
Used by multiple entities for image storage:
- Movie posters and backdrops
- Actor photos
- Director photos
- User avatars

## Resource Types
Supports multiple resource types:
- `IMAGE`: Standard images
- `RAW`: Raw image files
- `VIDEO`: Video thumbnails
- `AUTO`: Automatic type detection

## Integration
- Works with Cloudinary module for cloud storage
- Provides TypeORM repository for database operations
- Used across multiple other modules
