# Language Module

## Overview
The Language Module manages language support and internationalization features.

## Components

### Entity (`language.entity.ts`)
Core fields:
- `id`: UUID primary key
- `iso_639_1`: ISO language code
- `name`: Language name
- `english_name`: Language name in English
- `created_at` & `updated_at`: Timestamps

### Controller (`language.controller.ts`)
Handles language-related HTTP requests.

### Service (`language.service.ts`)
Implements:
- Language management
- ISO code handling
- Language preferences

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Language])
  ],
  controllers: [LanguageController],
  providers: [LanguageService],
  exports: [LanguageService]
})
```

## Features
- Language management
- ISO 639-1 code support
- Multi-language content support
- Language preference handling

## Integration
Used by:
- Movie module for titles and overviews
- User interface localization
- Content management
- Search functionality

## Constants
- `TOP_LANGUAGES`: Predefined list of most used languages
- ISO language code mappings

## Database Relations
- One-to-Many with Movies (original language)
- Used in alternative titles and overviews

## Input Validation
- ISO code validation
- Language name validation
- Required field validation
