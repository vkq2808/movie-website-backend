# Director Module

## Overview
The Director Module manages director information and their associations with movies.

## Components

### Entity (`director.entity.ts`)
Core fields:
- `id`: UUID primary key
- `name`: Director's full name
- `biography`: Biographical information
- `birth_date`: Date of birth
- `photo_url`: Optional URL to director's photo
- `movies`: Many-to-many relationship with movies
- `created_at` & `updated_at`: Timestamps

### Controller (`director.controller.ts`)
Handles director-related HTTP requests.

### Service (`director.service.ts`)
Implements:
- Director CRUD operations
- Movie association management
- Director search and filtering

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Director]),
  ],
  controllers: [DirectorController],
  providers: [DirectorService]
})
```

## Features
- Complete director profile management
- Movie association handling
- Search functionality

## Database Relations
- Many-to-Many relationship with Movies
- Uses TypeORM for database operations

## Input Validation
Uses class-validator decorators:
- `@IsNotEmpty()`: Required fields
- `@IsString()`: String validation
- `@IsDate()`: Birth date validation
- `@IsOptional()`: Optional fields
- `@IsUrl()`: Photo URL validation
