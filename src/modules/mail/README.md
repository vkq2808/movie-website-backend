# Mail Module

## Overview
The Mail Module handles all email communications in the application.

## Components

### Service (`mail.service.ts`)
Core functionality:
- Email sending
- Template management
- OTP delivery
- Notification handling

## Features
- Nodemailer integration
- HTML email support
- Template-based emails
- Async email queuing

## Usage Scenarios
1. User Registration
   - Verification emails
   - Welcome messages
   - OTP delivery

2. Password Reset
   - Reset links
   - Confirmation emails

3. Notifications
   - System updates
   - Account changes
   - Payment confirmations

## Module Configuration
```typescript
@Module({
  providers: [MailService],
  exports: [MailService],
})
```

## Integration
Used by:
- Auth Module for verification
- Payment Module for receipts
- User Module for notifications
- System notifications

## Security Features
- TLS/SSL support
- Email validation
- Rate limiting
- Spam prevention

## Error Handling
- Delivery failure handling
- Retry mechanism
- Error logging
- Bounce handling
