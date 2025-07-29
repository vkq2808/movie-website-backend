# Movie Purchase Module

This module handles the purchasing of movies using user wallet balance (abstract money system).

## Features

- **Purchase Movies**: Users can purchase movies using their wallet balance
- **Purchase History**: Track all movie purchases for each user
- **Ownership Verification**: Check if a user owns a specific movie
- **Wallet Integration**: Automatically deducts movie price from user's wallet
- **Duplicate Prevention**: Prevents users from purchasing the same movie twice

## Entities

### MoviePurchase
- `id`: Unique identifier (UUID)
- `user`: Reference to the User who made the purchase
- `movie`: Reference to the purchased Movie
- `purchase_price`: The price paid for the movie at time of purchase
- `purchased_at`: Timestamp when the purchase was made
- `created_at`: Entity creation timestamp
- `updated_at`: Entity last update timestamp

## API Endpoints

### POST /movie-purchases
Purchase a movie using wallet balance.

**Request Body:**
```json
{
  "movie_id": "uuid-of-movie"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Movie purchased successfully",
  "data": {
    "id": "purchase-uuid",
    "movie_id": "movie-uuid",
    "movie_title": "Movie Title",
    "purchase_price": 9.99,
    "purchased_at": "2025-07-22T10:00:00Z",
    "created_at": "2025-07-22T10:00:00Z"
  }
}
```

### GET /movie-purchases
Get all purchases for the authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "User purchases retrieved successfully",
  "data": [
    {
      "id": "purchase-uuid",
      "movie_id": "movie-uuid",
      "movie_title": "Movie Title",
      "purchase_price": 9.99,
      "purchased_at": "2025-07-22T10:00:00Z",
      "created_at": "2025-07-22T10:00:00Z"
    }
  ]
}
```

### GET /movie-purchases/:purchaseId
Get details of a specific purchase.

### GET /movie-purchases/check/:movieId
Check if the authenticated user owns a specific movie.

**Response:**
```json
{
  "success": true,
  "message": "Movie ownership checked successfully",
  "data": {
    "owns_movie": true
  }
}
```

## Error Handling

- **Insufficient Balance**: Returns 400 Bad Request if user doesn't have enough wallet balance
- **Movie Not Found**: Returns 404 Not Found if movie doesn't exist
- **Already Purchased**: Returns 409 Conflict if user already owns the movie
- **User Not Found**: Returns 404 Not Found if user doesn't exist

## Dependencies

- **WalletModule**: For balance management
- **MovieModule**: For movie information
- **AuthModule**: For user authentication

## Database Relations

- **User** (1:N) **MoviePurchase**: One user can have many purchases
- **Movie** (1:N) **MoviePurchase**: One movie can be purchased by many users
- **MoviePurchase** has unique constraint on (user, movie) to prevent duplicates

## Usage Example

1. User checks their wallet balance
2. User browses movies and sees prices
3. User selects a movie to purchase
4. System checks if user has sufficient balance
5. System deducts the price from user's wallet
6. System creates a purchase record
7. User can now access the purchased movie
