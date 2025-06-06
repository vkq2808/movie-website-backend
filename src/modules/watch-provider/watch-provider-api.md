# Watch Provider Module Documentation

## Overview
The Watch Provider module allows users to discover where they can watch movies across different streaming platforms, rental services, and purchase options. It supports:

- **Multiple availability types**: Stream, Rent, Buy, Free, Subscription, Premium
- **Regional availability**: Different platforms available in different countries
- **Pricing information**: Track rental/purchase prices with currency support
- **Quality options**: HD, SD, 4K resolution tracking
- **Language support**: Audio and subtitle language tracking
- **Availability windows**: Time-based availability tracking

## Entities

### WatchProvider
Main entity representing streaming platforms/services.

**Key Fields:**
- `provider_name`: Name of the service (e.g., "Netflix", "Amazon Prime")
- `logo_url`: Platform logo URL
- `website_url`: Official website
- `original_provider_id`: ID from external APIs (TMDB)
- `display_priority`: Order preference for UI display
- `is_active`: Whether the provider is currently active

### MovieWatchProvider
Junction entity linking movies to watch providers with additional metadata.

**Key Fields:**
- `availability_type`: How the movie is available (stream, rent, buy, etc.)
- `region`: Country/region code (ISO)
- `price`/`currency`: Pricing information for rentals/purchases
- `quality`: Video quality (HD, SD, 4K)
- `audio_language`: Available audio language
- `subtitle_languages`: Available subtitle languages
- `watch_url`: Direct link to watch the movie
- `available_from`/`available_until`: Availability time window

## API Endpoints

### Watch Providers
- `GET /watch-providers/providers` - Get all providers
- `GET /watch-providers/providers/popular` - Get popular providers by region
- `GET /watch-providers/providers/:id` - Get provider by ID
- `POST /watch-providers/providers` - Create new provider
- `PUT /watch-providers/providers/:id` - Update provider
- `DELETE /watch-providers/providers/:id` - Delete provider

### Movie Watch Providers
- `GET /watch-providers/movies/:movieId` - Get watch options for a movie
- `GET /watch-providers/movies/:movieId/grouped` - Get options grouped by type
- `GET /watch-providers/movies/:movieId/stats` - Get statistics
- `GET /watch-providers/movies/:movieId/cheapest` - Find cheapest option
- `POST /watch-providers/movies/sync` - Sync from external API
- `POST /watch-providers/movies` - Create movie watch provider
- `PUT /watch-providers/movies/:id/availability` - Update availability
- `DELETE /watch-providers/movies/:id` - Delete movie watch provider

### Utility Endpoints
- `GET /watch-providers/regions` - Get available regions
- `PUT /watch-providers/movies/:movieId/bulk-availability` - Bulk update availability

## Usage Examples

### Finding where to watch a movie
```typescript
// Get all watch options for a movie in the US
const response = await fetch('/watch-providers/movies/movie-uuid?region=US');

// Get only streaming options
const streamingOptions = await fetch('/watch-providers/movies/movie-uuid?region=US&types=subscription,stream');

// Get options grouped by availability type
const groupedOptions = await fetch('/watch-providers/movies/movie-uuid/grouped?region=US');
```

### Syncing from external APIs (TMDB)
```typescript
const syncData = {
  syncDto: {
    movieId: "movie-uuid",
    originalMovieId: 12345,
    region: "US"
  },
  apiData: {
    link: "https://www.themoviedb.org/movie/12345/watch",
    flatrate: [
      {
        id: 8,
        provider_name: "Netflix",
        logo_path: "/path/to/logo.jpg",
        display_priority: 1
      }
    ],
    rent: [
      {
        id: 2,
        provider_name: "Apple TV",
        logo_path: "/path/to/logo.jpg",
        display_priority: 5
      }
    ]
  }
};

const response = await fetch('/watch-providers/movies/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(syncData)
});
```

## Database Schema

### Tables
- `watch_provider` - Main provider information
- `movie_watch_provider` - Many-to-many with metadata

### Key Relationships
- `Movie` ↔ `MovieWatchProvider` ↔ `WatchProvider` (Many-to-Many)
- Unique constraint on (movie, watch_provider, availability_type, region)

## Features

### Regional Support
The module supports different availability by region using ISO country codes:
- US, GB, JP, DE, FR, etc.
- Each movie-provider combination can have different availability per region

### Availability Types
- **STREAM**: Available for streaming (usually subscription)
- **RENT**: Available for rental (temporary access)
- **BUY**: Available for purchase (permanent access)
- **FREE**: Available for free (with or without ads)
- **SUBSCRIPTION**: Available with subscription
- **PREMIUM**: Premium tier subscription required

### Business Logic
- Find cheapest rental/purchase options
- Popular providers by region
- Availability statistics
- Bulk operations for content management
- Time-based availability windows

## Integration

The module is designed to integrate with:
- **TMDB API**: For syncing watch provider data
- **Movie Module**: Core movie entities
- **Frontend**: Providing structured data for UI components

## Error Handling

All endpoints return standardized responses:
```json
{
  "success": boolean,
  "data": any,
  "message": string
}
```

Failed operations return appropriate HTTP status codes with descriptive error messages.
