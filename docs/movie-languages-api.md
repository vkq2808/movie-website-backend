# Movie Language API

This document describes the API endpoints for managing movie languages in the system.

## Add Language to Movie

Add a language to a movie's spoken languages list.

**URL**: `/movie/:id/languages/add`

**Method**: `POST`

**Auth required**: Yes (Admin role)

**Request Body**:
```json
{
  "languageIsoCode": "en"
}
```

**Success Response**:
- **Code**: `200 OK`
- **Content example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Example Movie",
  "spoken_languages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "English",
      "englishName": "English",
      "iso_639_1": "en"
    }
  ],
  "original_language": "en",
  // other movie properties...
}
```

**Error Responses**:
- **Code**: `404 Not Found`
- **Content**:
```json
{
  "statusCode": 404,
  "message": "Movie with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

## Remove Language from Movie

Remove a language from a movie's spoken languages list.

**URL**: `/movie/:id/languages/remove`

**Method**: `POST`

**Auth required**: Yes (Admin role)

**Request Body**:
```json
{
  "languageIsoCode": "en"
}
```

**Success Response**:
- **Code**: `200 OK`
- **Content example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Example Movie",
  "spoken_languages": [],
  "original_language": "en",
  // other movie properties...
}
```

**Error Responses**:
- **Code**: `404 Not Found`
- **Content**:
```json
{
  "statusCode": 404,
  "message": "Movie with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

## Create Movie with Language

Create a new movie with language information.

**URL**: `/movie`

**Method**: `POST`

**Auth required**: Yes (Admin role)

**Request Body**:
```json
{
  "title": "Example Movie",
  "overview": "Movie description",
  "languageIsoCode": "en",
  "release_date": "2023-01-01",
  // other movie properties...
}
```

**Success Response**:
- **Code**: `201 Created`
- **Content example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Example Movie",
  "overview": "Movie description",
  "spoken_languages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "English",
      "englishName": "English",
      "iso_639_1": "en"
    }
  ],
  "original_language": "en",
  "release_date": "2023-01-01",
  // other movie properties...
}
```

## Update Movie with Language

Update an existing movie with language information.

**URL**: `/movie/:id`

**Method**: `POST`

**Auth required**: Yes (Admin role)

**Request Body**:
```json
{
  "title": "Updated Movie Title",
  "languageIsoCode": "fr",
  // other movie properties to update...
}
```

**Success Response**:
- **Code**: `200 OK`
- **Content example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Updated Movie Title",
  "spoken_languages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "English",
      "englishName": "English",
      "iso_639_1": "en"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "French",
      "englishName": "French",
      "iso_639_1": "fr"
    }
  ],
  "original_language": "fr",
  // other movie properties...
}
```

**Error Responses**:
- **Code**: `404 Not Found`
- **Content**:
```json
{
  "statusCode": 404,
  "message": "Movie with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```
