# Movie Module

## Overview
The Movie Module is the core module handling movie-related operations and data management.

## Components

### Entities

#### Movie Entity (`movie.entity.ts`)
- `id`: UUID primary key
- `adult`: Boolean flag for adult content
- `backdrop`: One-to-one relation with Image
- `budget`: Movie budget
- `genres`: Many-to-many with Genre
- `homepage`: Movie website
- `imdb_id`: IMDB identifier
- `original_language`: Many-to-one with Language
- `original_title`: Original movie title
- `overview`: Movie description
- `popularity`: Popularity score
- `poster`: One-to-one with Image
- `release_date`: Release date
- `status`: Movie status
- `tagline`: Movie tagline
- `title`: Localized title
- `video`: Video availability flag
- `vote_average`: Average rating
- `vote_count`: Number of votes
- `videos`: One-to-many with Video

#### Alternative Entities
- `AlternativeTitle`: Movie titles in different languages
- `AlternativeOverview`: Movie descriptions in different languages

### Controller (`movie.controller.ts`)
Key endpoints:
- GET /movie: List movies with pagination
- GET /movie/slides: Get featured movies
- GET /movie/:id: Get movie details
- GET /movie/:id/alternative-titles: Get translations
- POST /movie/:id/import-alternative-titles: Import translations
- POST /movie/:id/update-alternative-titles: Update translations

### Service (`movie.service.ts`)
Features:
- Movie CRUD operations
- Alternative title management
- Movie search and filtering
- Language-specific content handling
- Movie metadata management

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Movie,
      Genre,
      Image,
      Video,
      Language,
      AlternativeOverview,
      AlternativeTitle
    ]),
    LanguageModule
  ],
  controllers: [MovieController],
  providers: [
    MovieService,
    AlternativeOverviewService,
    AlternativeTitleService
  ],
  exports: [MovieService, AlternativeTitleService]
})
```

## Key Features
- Multilingual support
- Rich media handling (images, videos)
- Genre classification
- Rating system
- Search and filtering
- Pagination support

## Relations
- Genres (Many-to-Many)
- Videos (One-to-Many)
- Images (One-to-One for poster and backdrop)
- Language (Many-to-One)
- Alternative Titles (One-to-Many)
- Alternative Overviews (One-to-Many)

## Input Validation
Uses class-validator for:
- Required fields
- Numeric ranges
- String formats
- Date validation
- URL validation
