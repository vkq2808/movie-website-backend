# Production Company API Documentation

## Overview
The Production Company API provides endpoints for managing production companies and their relationships with movies. Production companies are the entities that produce, finance, or distribute films.

## Base URL
```
/production-companies
```

## Endpoints

### 1. Get All Production Companies
**GET** `/production-companies`

Retrieve a list of all production companies with optional filtering.

**Query Parameters:**
- `name` (string, optional): Filter by company name (partial match)
- `origin_country` (string, optional): Filter by country of origin
- `is_active` (boolean, optional): Filter by active status
- `limit` (number, optional): Limit number of results (default: 50)
- `offset` (number, optional): Number of results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Marvel Studios",
      "description": "American film and television production company",
      "homepage": "https://www.marvel.com",
      "headquarters": "Burbank, California",
      "origin_country": "US",
      "parent_company": null,
      "logo": {
        "id": "uuid",
        "url": "https://example.com/logo.png",
        "alt_text": "Marvel Studios Logo"
      },
      "original_id": 420,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "message": "Production companies retrieved successfully"
}
```

### 2. Get Popular Production Companies
**GET** `/production-companies/popular`

Retrieve the most popular production companies based on the number of movies they've produced.

**Query Parameters:**
- `limit` (number, optional): Number of companies to return (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Marvel Studios",
      "logo": {...},
      "movies_count": 30
    }
  ],
  "message": "Popular production companies retrieved successfully"
}
```

### 3. Search Production Companies
**GET** `/production-companies/search`

Search for production companies by name.

**Query Parameters:**
- `q` (string, required): Search term
- `limit` (number, optional): Number of results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Marvel Studios",
      "logo": {...},
      "origin_country": "US"
    }
  ],
  "message": "Search results retrieved successfully"
}
```

### 4. Get Production Companies by Country
**GET** `/production-companies/by-country/:country`

Retrieve all production companies from a specific country.

**Path Parameters:**
- `country` (string): Country code (e.g., "US", "GB", "JP")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Marvel Studios",
      "headquarters": "Burbank, California",
      "origin_country": "US"
    }
  ],
  "message": "Production companies from US retrieved successfully"
}
```

### 5. Get Production Company by ID
**GET** `/production-companies/:id`

Retrieve detailed information about a specific production company.

**Path Parameters:**
- `id` (string): Production company UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Marvel Studios",
    "description": "American film and television production company",
    "homepage": "https://www.marvel.com",
    "headquarters": "Burbank, California",
    "origin_country": "US",
    "parent_company": null,
    "logo": {...},
    "original_id": 420,
    "is_active": true,
    "movies": [
      {
        "id": "uuid",
        "title": "Avengers: Endgame",
        "release_date": "2019-04-26",
        "poster": {...}
      }
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "Production company retrieved successfully"
}
```

### 6. Get Movies by Production Company
**GET** `/production-companies/:id/movies`

Retrieve all movies produced by a specific company.

**Path Parameters:**
- `id` (string): Production company UUID

**Query Parameters:**
- `limit` (number, optional): Number of movies to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Avengers: Endgame",
      "release_date": "2019-04-26",
      "poster": {...},
      "backdrop": {...},
      "genres": [...]
    }
  ],
  "message": "Movies by production company retrieved successfully"
}
```

### 7. Create Production Company
**POST** `/production-companies`

Create a new production company.

**Request Body:**
```json
{
  "name": "New Studios",
  "description": "A new film production company",
  "homepage": "https://newstudios.com",
  "headquarters": "Los Angeles, California",
  "origin_country": "US",
  "parent_company": "Parent Company Name",
  "logo_id": "uuid",
  "original_id": 12345,
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "New Studios",
    "description": "A new film production company",
    ...
  },
  "message": "Production company created successfully"
}
```

### 8. Add Movie to Production Company
**POST** `/production-companies/add-movie`

Associate a movie with a production company.

**Request Body:**
```json
{
  "movie_id": "uuid",
  "production_company_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Movie added to production company successfully"
}
```

### 9. Update Production Company
**PUT** `/production-companies/:id`

Update an existing production company.

**Path Parameters:**
- `id` (string): Production company UUID

**Request Body:** (same as create, all fields optional)
```json
{
  "name": "Updated Studios Name",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Studios Name",
    ...
  },
  "message": "Production company updated successfully"
}
```

### 10. Delete Production Company
**DELETE** `/production-companies/:id`

Delete a production company.

**Path Parameters:**
- `id` (string): Production company UUID

**Response:**
```json
{
  "success": true,
  "message": "Production company deleted successfully"
}
```

### 11. Remove Movie from Production Company
**DELETE** `/production-companies/:companyId/movies/:movieId`

Remove the association between a movie and a production company.

**Path Parameters:**
- `companyId` (string): Production company UUID
- `movieId` (string): Movie UUID

**Response:**
```json
{
  "success": true,
  "message": "Movie removed from production company successfully"
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message",
  "statusCode": 400
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Production company not found",
  "statusCode": 404
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "statusCode": 500
}
```

## Usage Examples

### Example 1: Search for Disney Studios
```bash
curl -X GET "http://localhost:3000/production-companies/search?q=Disney&limit=5"
```

### Example 2: Get all movies by Marvel Studios
```bash
curl -X GET "http://localhost:3000/production-companies/marvel-uuid/movies?limit=10"
```

### Example 3: Create a new production company
```bash
curl -X POST "http://localhost:3000/production-companies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Indie Films Studio",
    "description": "Independent film production company",
    "origin_country": "US",
    "original_id": 99999
  }'
```

### Example 4: Associate a movie with a production company
```bash
curl -X POST "http://localhost:3000/production-companies/add-movie" \
  -H "Content-Type: application/json" \
  -d '{
    "movie_id": "movie-uuid",
    "production_company_id": "company-uuid"
  }'
```

## Integration with Movies

Production companies have a many-to-many relationship with movies, allowing:

1. **Accurate Crediting**: Movies can be associated with multiple production companies (producer, distributor, co-producer, etc.)
2. **Enhanced Filtering**: Users can filter movies by production company
3. **Analytics**: Track performance metrics by production company
4. **User Interface**: Display company logos and information on movie pages
5. **Discovery**: Users can explore movies from their favorite studios

## Database Schema

The production companies are stored with the following key relationships:
- Many-to-many with movies through `movie_production_company` join table
- One-to-one with logo images
- Self-referential relationship for parent companies
