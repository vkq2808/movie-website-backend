# Alternative Title API Documentation

This document describes the API endpoints related to alternative movie titles.

## Get Alternative Titles for a Movie

Retrieves all alternative titles for a specific movie.

**URL**: `/movie/:id/alternative-titles`

**Method**: `GET`

**URL Parameters**:
- `id`: The UUID of the movie

**Response**:
```json
[
  {
    "id": "uuid",
    "title": "Movie Title in Spanish",
    "countryCode": "ES",
    "type": "alternative",
    "movieId": "movie-uuid",
    "created_at": "2023-05-29T12:34:56.789Z",
    "updated_at": "2023-05-29T12:34:56.789Z"
  },
  {
    "id": "uuid",
    "title": "Movie Title in French",
    "countryCode": "FR",
    "type": "alternative",
    "movieId": "movie-uuid",
    "created_at": "2023-05-29T12:34:56.789Z",
    "updated_at": "2023-05-29T12:34:56.789Z"
  }
]
```

## Import Alternative Titles from TMDB

Imports alternative titles for a movie from TMDB by providing the TMDB movie ID.

**URL**: `/movie/:id/import-alternative-titles`

**Method**: `POST`

**URL Parameters**:
- `id`: The UUID of the movie

**Request Body**:
```json
{
  "tmdbId": 12345
}
```

**Response**:
```json
{
  "message": "Successfully imported 10 alternative titles",
  "titles": [
    {
      "id": "uuid",
      "title": "Movie Title in Spanish",
      "countryCode": "ES",
      "type": "alternative",
      "movieId": "movie-uuid",
      "created_at": "2023-05-29T12:34:56.789Z",
      "updated_at": "2023-05-29T12:34:56.789Z"
    },
    // Additional titles...
  ]
}
```

## Update Movie with Alternative Titles

Updates a movie with alternative titles fetched from TMDB using the movie's original TMDB ID.

**URL**: `/movie/:id/update-alternative-titles`

**Method**: `POST`

**URL Parameters**:
- `id`: The UUID of the movie

**Response**:
```json
{
  "success": true,
  "message": "Successfully updated movie with 10 alternative titles",
  "count": 10,
  "titles": [
    {
      "id": "uuid",
      "title": "Movie Title in Spanish",
      "countryCode": "ES",
      "type": "alternative",
      "movieId": "movie-uuid",
      "created_at": "2023-05-29T12:34:56.789Z",
      "updated_at": "2023-05-29T12:34:56.789Z"
    },
    // Additional titles...
  ]
}
```

## Get Movies with Alternative Titles

Retrieves a list of movies with their alternative titles, paginated.

**URL**: `/movie`

**Method**: `GET`

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Number of movies per page (default: 10)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Original Movie Title",
      "overview": "Movie description",
      "alternativeTitles": [
        {
          "id": "uuid",
          "title": "Movie Title in Spanish",
          "countryCode": "ES",
          "type": "alternative",
          "movieId": "movie-uuid",
          "created_at": "2023-05-29T12:34:56.789Z",
          "updated_at": "2023-05-29T12:34:56.789Z"
        }
      ]
    },
    // Additional movies...
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalCount": 100,
    "totalPages": 10
  }
}
```
