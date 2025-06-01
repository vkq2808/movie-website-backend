# Cloudinary Module

## Overview
The Cloudinary Module handles cloud-based image and media management.

## Components

### Service (`cloudinary.service.ts`)
Implements:
- Image upload
- Image transformation
- Asset management
- URL generation

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Image, Movie]),
  ],
  providers: [CloudinaryService],
  exports: [CloudinaryService]
})
```

## Features

### Image Management
- Upload handling
- Format conversion
- Size optimization
- Quality control
- CDN delivery

### Transformations
- Resizing
- Cropping
- Format conversion
- Quality optimization
- Filters and effects

### Asset Types
- Movie posters
- Backdrops
- Actor photos
- User avatars
- System images

### URL Management
- Secure URL generation
- Transformation URLs
- CDN optimization
- Cache control

## Integration
Used by:
- Movie Module
- Actor Module
- User Module
- Image Module

## Security Features
- Secure upload
- Access control
- Resource validation
- Upload limits
- Format restrictions

## Performance
- CDN distribution
- Image optimization
- Lazy loading support
- Cache management

## Error Handling
- Upload failures
- Transformation errors
- Resource limits
- Invalid formats
