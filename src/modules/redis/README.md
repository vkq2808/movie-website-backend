# Redis Module

## Overview
The Redis Module provides caching and temporary data storage functionality.

## Components

### Service (`redis.service.ts`)
Core functionality:
- Key-value storage
- Cache management
- Session handling
- OTP storage

## Module Configuration
```typescript
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
```

## Features

### Caching
- Response caching
- Query result caching
- Frequently accessed data

### Session Management
- User sessions
- Authentication tokens
- Temporary data storage

### OTP Management
- OTP storage
- Expiration handling
- Verification tracking

### Rate Limiting
- Request rate limiting
- API throttling
- Abuse prevention

## Key Operations
- `set`: Store key-value pairs
- `get`: Retrieve values
- `del`: Delete keys
- `expire`: Set expiration time
- `exists`: Check key existence

## Error Handling
- Connection error handling
- Operation timeouts
- Retry mechanisms
- Error logging

## Integration
Used by:
- Auth Module for OTP
- Session management
- Rate limiting
- Temporary data storage

## Security
- Data encryption
- Secure connections
- Key expiration
- Access control
