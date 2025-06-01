# Backend Modules Documentation

## Overview
This document provides detailed information about each module in the backend of the graduation project.

## Core Modules

### 1. Actor Module
- **Purpose**: Manages actor-related operations
- **Main Components**:
  - `Actor` entity: Stores actor information (name, biography, birth_date, photo_url)
  - `ActorController`: Handles actor-related HTTP requests
  - `ActorService`: Business logic for actor operations
- **Relations**: Many-to-many relationship with Movies

### 2. Auth Module
- **Purpose**: Handles authentication and user management
- **Main Components**:
  - `User` entity: Stores user information
  - `AuthController`: Handles auth operations (login, register, verify, etc.)
  - `AuthService`: Business logic for auth operations
- **Key Features**:
  - User registration and login
  - OTP verification
  - Password reset functionality
  - JWT authentication
  - Role-based authorization
- **Dependencies**: Redis Module, Mail Module

### 3. Movie Module
- **Purpose**: Core module for movie management
- **Main Components**:
  - `Movie` entity: Stores movie details
  - `MovieController`: Handles movie-related HTTP requests
  - `MovieService`: Business logic for movie operations
  - `AlternativeTitle` & `AlternativeOverview`: Support for multiple languages
- **Key Features**:
  - Movie CRUD operations
  - Alternative titles and overviews in different languages
  - Movie search and filtering
  - Pagination support
- **Relations**:
  - Genres (Many-to-Many)
  - Videos (One-to-Many)
  - Images (One-to-One for poster and backdrop)
  - Language (Many-to-One)

### 4. Genre Module
- **Purpose**: Manages movie genres
- **Main Components**:
  - `Genre` entity: Stores genre information
  - `GenreController`: Handles genre-related requests
  - `GenreService`: Business logic for genre operations
- **Relations**: Many-to-many relationship with Movies

### 5. Director Module
- **Purpose**: Manages director information
- **Main Components**:
  - `Director` entity: Stores director details (name, biography, birth_date)
  - `DirectorController`: Handles director-related requests
  - `DirectorService`: Business logic for director operations
- **Relations**: Many-to-many relationship with Movies

### 6. Episode & Episode-Server Modules
- **Purpose**: Manages movie episodes and their streaming servers
- **Main Components**:
  - `Episode` entity: Stores episode information
  - `EpisodeServer` entity: Stores streaming server details
  - Associated controllers and services
- **Key Features**:
  - Episode management
  - Multiple server support for each episode
  - Duration tracking

### 7. Video Module
- **Purpose**: Handles video-related operations
- **Main Components**:
  - `Video` entity: Stores video metadata
  - `VideoController`: Handles video-related requests
  - `VideoService`: Business logic for video operations
- **Features**: Supports multiple video types and sources

## User Interaction Modules

### 8. Chat Module
- **Purpose**: Manages user chat functionality
- **Main Components**:
  - `Chat` entity
  - `ChatController`
  - `ChatService`

### 9. Feedback Module
- **Purpose**: Handles user feedback
- **Main Components**:
  - `Feedback` entity
  - `FeedbackController`
  - `FeedbackService`

### 10. SearchHistory Module
- **Purpose**: Tracks user search history
- **Main Components**:
  - `SearchHistory` entity
  - `SearchHistoryController`
  - `SearchHistoryService`
- **Relations**: Associated with User entity

### 11. WatchHistory Module
- **Purpose**: Tracks user watch history
- **Main Components**:
  - `WatchHistory` entity
  - `WatchHistoryController`
  - `WatchHistoryService`
- **Relations**: Associated with User and Movie entities

## Payment and Wallet Modules

### 12. Payment Module
- **Purpose**: Handles payment transactions
- **Main Components**:
  - `Payment` entity: Stores payment information
  - `PaymentController`: Handles payment requests
  - `PaymentService`: Business logic for payments
- **Features**:
  - Multiple payment methods
  - Payment status tracking
- **Relations**: Associated with User entity

### 13. Wallet Module
- **Purpose**: Manages user wallets
- **Main Components**:
  - `Wallet` entity
  - `WalletController`
  - `WalletService`
- **Relations**: One-to-One with User entity

## Support Modules

### 14. Redis Module
- **Purpose**: Handles caching and temporary data storage
- **Main Component**: `RedisService`
- **Usage**: OTP storage, session management

### 15. Mail Module
- **Purpose**: Handles email communications
- **Main Component**: `MailService`
- **Features**: Email notifications, OTP delivery

### 16. Language Module
- **Purpose**: Manages language support
- **Features**: Supports multilingual content

### 17. Cloudinary Module
- **Purpose**: Handles cloud image storage
- **Features**: Image upload and management for movies and users

### 18. Image Module
- **Purpose**: Manages image resources
- **Main Components**:
  - `Image` entity
  - Support for different image types
- **Relations**: Used by multiple entities for image storage

## Database Integration

All modules use TypeORM for database operations with PostgreSQL. The project utilizes:
- Entity relationships (One-to-One, One-to-Many, Many-to-Many)
- Automatic schema synchronization in development
- Repository pattern for data access
- SSL support for Supabase connections

## Security Features

- JWT-based authentication
- Role-based access control
- Input validation using class-validator
- Environment-based configuration
- Secure password handling

## Configuration

All modules use the `ConfigModule` for:
- Environment variable management
- Database configuration
- Service-specific settings
