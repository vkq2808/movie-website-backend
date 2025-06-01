# Actor Module

## Overview
The Actor Module manages actor information for the movie platform.

## Components

### Entity
`actor.entity.ts`:
- `id`: UUID primary key
- `name`: Actor's full name
- `biography`: Actor's biographical information
- `birth_date`: Actor's date of birth
- `photo_url`: URL to actor's photo (optional)
- `movies`: Many-to-many relationship with Movie entity
- `created_at` & `updated_at`: Timestamps

### Controller (`actor.controller.ts`)
Handles HTTP requests for actor operations.

### Service (`actor.service.ts`)
Implements business logic for:
- Actor CRUD operations
- Movie association management
- Actor search and filtering

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Actor, Movie])
  ],
  controllers: [ActorController],
  providers: [ActorService],
  exports: [ActorService]
})
```

## Database Relations
- Many-to-Many relationship with Movies through `actor_movies` junction table
- Uses TypeORM for database operations

## Input Validation
Uses class-validator decorators:
- `@IsNotEmpty()`: Required fields
- `@IsString()`: String fields
- `@IsDateString()`: Date fields
- `@IsUrl()`: Photo URL validation
