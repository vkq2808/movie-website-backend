# Recommendation System Module

## Overview
The Recommendation System provides personalized movie recommendations based on user behavior, preferences, and collaborative filtering. It combines multiple recommendation strategies to deliver relevant content suggestions.

## Features

### 🎯 Recommendation Types
1. **Content-Based Filtering**: Recommends movies based on user's favorite genres, languages, and movie characteristics
2. **Collaborative Filtering**: Suggests movies liked by users with similar preferences
3. **Hybrid Approach**: Combines content-based and collaborative filtering for better accuracy
4. **Trending Recommendations**: Shows currently popular and highly-rated movies

### 📊 Recommendation Sources
- **Genres**: Based on user's preferred movie genres
- **Languages**: Movies in user's preferred languages
- **Production Companies**: From companies of liked movies
- **User Behavior**: Watch history and interaction patterns
- **Similar Users**: Recommendations from users with similar taste

### 🔄 Real-time Updates
- Automatic recommendation refresh based on user activity
- Configurable expiration times for different recommendation types
- Background job support for bulk recommendation generation

## API Endpoints

### User Endpoints

#### `GET /recommendations`
Get personalized recommendations for the authenticated user.

**Query Parameters:**
- `type` (optional): Filter by recommendation type (`content_based`, `collaborative`, `hybrid`, `trending`)
- `limit` (optional): Number of recommendations (1-100, default: 20)
- `page` (optional): Page number for pagination (default: 1)
- `genres[]` (optional): Filter by specific genre IDs
- `languages[]` (optional): Filter by language codes
- `exclude_watched` (optional): Exclude already watched movies (default: true)
- `exclude_purchased` (optional): Exclude purchased movies (default: false)
- `min_score` (optional): Minimum recommendation score (0-10, default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Recommendations retrieved successfully",
  "data": {
    "recommendations": [
      {
        "id": "rec-uuid",
        "movie": {
          "id": "movie-uuid",
          "title": "Movie Title",
          "poster": {...},
          "genres": [...],
          ...
        },
        "recommendation_type": "hybrid",
        "sources": ["genres", "user_behavior"],
        "score": 8.5,
        "metadata": {
          "matching_genres": ["Action", "Drama"],
          "reasoning": "Based on your interest in Action, Drama movies",
          "content_similarity_score": 0.75
        },
        "created_at": "2025-07-31T10:00:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

#### `POST /recommendations/generate`
Generate new recommendations for the authenticated user.

**Request Body:**
```json
{
  "type": "hybrid",
  "limit": 50,
  "force_refresh": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recommendations generated successfully",
  "data": {
    "generated": 45,
    "updated": 5
  }
}
```

#### `GET /recommendations/stats`
Get recommendation statistics for the authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "Recommendation statistics retrieved successfully",
  "data": {
    "total_recommendations": 45,
    "by_type": {
      "content_based": 15,
      "collaborative": 10,
      "hybrid": 20
    },
    "by_source": {
      "genres": 25,
      "user_behavior": 20,
      "similar_users": 15
    },
    "average_score": 7.8,
    "last_updated": "2025-07-31T10:00:00Z"
  }
}
```

#### `GET /recommendations/trending`
Get trending movies (public endpoint).

**Query Parameters:**
- `limit` (optional): Number of movies (default: 20)
- `page` (optional): Page number (default: 1)

### Admin Endpoints

#### `POST /recommendations/bulk-generate`
Generate recommendations for multiple users (Admin only).

**Request Body:**
```json
{
  "user_ids": ["user1", "user2"],
  "limit_per_user": 50,
  "force_refresh": true
}
```

## Recommendation Algorithm

### Content-Based Filtering
1. **User Profile Creation**: Analyzes user's favorite movies and watch history
2. **Genre Preferences**: Extracts preferred genres based on user activity
3. **Language Preferences**: Identifies preferred movie languages
4. **Similarity Scoring**: Calculates content similarity using:
   - Genre overlap (30% weight)
   - Language preference (20% weight)
   - Movie quality metrics (30% weight)
   - Popularity score (20% weight)

### Collaborative Filtering
1. **User Similarity**: Finds users with similar movie preferences
2. **Neighbor Selection**: Identifies top 10 most similar users
3. **Recommendation Generation**: Suggests movies liked by similar users
4. **Score Calculation**: `similarity_score × movie_rating / 10`

### Hybrid Approach
- **Content Weight**: 60% of final score
- **Collaborative Weight**: 40% of final score
- **Deduplication**: Removes duplicate recommendations
- **Score Normalization**: Ensures scores are within 0-10 range

## Configuration

### Environment Variables
```env
# Recommendation settings
RECOMMENDATION_CACHE_TTL=3600
RECOMMENDATION_DEFAULT_LIMIT=20
RECOMMENDATION_MAX_LIMIT=100
RECOMMENDATION_EXPIRY_DAYS=7
```

### Database Schema
The recommendation system uses the `recommendations` table with the following structure:

```sql
CREATE TABLE recommendations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  recommendation_type recommendation_type_enum,
  sources recommendation_source_enum[],
  score FLOAT,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, movie_id)
);
```

### Indexes
- `(user_id, movie_id)` - Unique constraint
- `(user_id, recommendation_type)` - Filter by type
- `(user_id, score)` - Sorting by score
- `(created_at)` - Time-based queries

## Usage Examples

### Frontend Integration
```typescript
// Get personalized recommendations
const recommendations = await getRecommendations({
  type: 'hybrid',
  limit: 10,
  exclude_watched: true,
  genres: ['action', 'drama']
});

// Generate fresh recommendations
await generateRecommendations({
  force_refresh: true,
  limit: 50
});

// Get recommendation stats
const stats = await getRecommendationStats();
```

### Background Jobs
The system supports background recommendation generation:

```typescript
// Schedule recommendation updates
@Cron('0 2 * * *') // Daily at 2 AM
async updateRecommendations() {
  await this.recommendationService.bulkGenerateRecommendations();
}
```

## Performance Considerations

### Caching Strategy
- **User Recommendations**: Cached for 1 hour
- **Trending Movies**: Cached for 6 hours
- **User Similarity**: Cached for 24 hours

### Optimization
- **Batch Processing**: Generate recommendations in batches
- **Lazy Loading**: Generate recommendations on-demand for new users
- **Expiration Management**: Clean up expired recommendations automatically

### Scalability
- **Database Indexing**: Optimized queries with proper indexes
- **Pagination**: Efficient pagination for large recommendation sets
- **Background Processing**: Async recommendation generation

## Monitoring and Analytics

### Metrics to Track
- **Recommendation Accuracy**: Click-through rates
- **User Engagement**: Time spent with recommended content
- **Coverage**: Percentage of catalog recommended
- **Novelty**: Diversity of recommendations

### Logging
The system logs:
- Recommendation generation events
- User interaction with recommendations
- Algorithm performance metrics
- Error rates and debugging information

## Future Enhancements

### Planned Features
1. **Deep Learning Integration**: Neural collaborative filtering
2. **Real-time Updates**: Stream-based recommendation updates
3. **A/B Testing**: Algorithm comparison framework
4. **Multi-armed Bandits**: Exploration vs exploitation optimization
5. **Seasonal Recommendations**: Time-aware recommendations
6. **Social Features**: Friend-based recommendations

### API Extensions
- **Explanation API**: Why this movie was recommended
- **Feedback API**: User rating for recommendations
- **Diversity Controls**: Adjust recommendation diversity
- **Time-based Filtering**: Recommendations by release period

## Dependencies
- **TypeORM**: Database ORM
- **NestJS**: Framework and dependency injection
- **PostgreSQL**: Database with JSONB support
- **JWT**: User authentication
- **Class Validator**: Input validation
