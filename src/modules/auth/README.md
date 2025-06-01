# Auth Module

## Overview
The Auth Module handles user authentication, authorization, and user management.

## Components

### Entities

#### User Entity (`user.entity.ts`)
- `id`: UUID primary key
- `username`: User's display name
- `email`: Unique email address
- `password`: Hashed password
- `birthdate`: Optional date of birth
- `role`: User role (Customer/Admin)
- `is_verified`: Email verification status
- `is_active`: Account status
- Relations:
  - `favorite_movies`: Many-to-many with Movie
  - `payments`: One-to-many with Payment
  - `chats`: One-to-many with Chat
  - `feedbacks`: One-to-many with Feedback
  - `search_histories`: One-to-many with SearchHistory
  - `watch_histories`: One-to-many with WatchHistory
  - `wallet`: One-to-one with Wallet

### Controller (`auth.controller.ts`)
Endpoints:
- `POST /auth/register`: User registration
- `POST /auth/verify`: Email verification
- `POST /auth/resend-otp`: Resend verification OTP
- `POST /auth/login`: User login
- `POST /auth/forget-password`: Password reset request
- `POST /auth/reset-password`: Password reset
- Google OAuth2 integration

### Service (`auth.service.ts`)
Implements:
- User registration and verification
- Password hashing and verification
- JWT token generation and validation
- OTP generation and verification
- Password reset functionality

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '30d',
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
```

## Dependencies
- Redis Module: OTP storage
- Mail Module: Email notifications
- JWT Module: Token generation/validation

## Security Features
- Password hashing using bcrypt
- JWT-based authentication
- Role-based access control
- Email verification
- OTP expiration
- Rate limiting
- Input validation using class-validator
