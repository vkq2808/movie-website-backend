# Genre Module

## Overview
The Genre Module manages movie genre categorization and relationships.

## Components

### Entity (`genre.entity.ts`)
Core fields:
- `id`: UUID primary key
- `name`: Genre name
- `movies`: Many-to-many relationship with Movie entity
- `created_at` & `updated_at`: Timestamps

### Controller (`genre.controller.ts`)
Implements endpoints for genre management.

### Service (`genre.service.ts`)
Features:
- Genre CRUD operations
- Movie association management
- Genre listing and filtering

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Genre])
  ],
  controllers: [GenreController],
  providers: [GenreService],
  exports: [GenreService]
})
```

## Features
- Genre management
- Movie categorization
- Multi-language support for genre names
- Genre-based movie filtering

## Database Relations
- Many-to-Many relationship with Movies
- Uses TypeORM for database operations

## Static Methods
- `create(name: string, languageCode: string)`: Factory method for genre creation

## Input Validation
Uses class-validator for:
- Required fields
- String validation
- Language code validation
