# Payment Module

## Overview
The Payment Module handles all payment-related operations and transactions.

## Components

### Entity (`payment.entity.ts`)
Core fields:
- `id`: UUID primary key
- `user`: Relation to User entity
- `amount`: Decimal amount
- `payment_method`: Payment method enum
- `payment_status`: Status enum
- `created_at` & `updated_at`: Timestamps

### Controller (`payment.controller.ts`)
Handles payment-related HTTP requests.

### Service (`payment.service.ts`)
Implements:
- Payment processing
- Transaction management
- Payment status updates
- Receipt generation

## Module Configuration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Payment, User])
  ],
  controllers: [PaymentController],
  providers: [PaymentService]
})
```

## Features
- Multiple payment methods
- Payment status tracking
- Transaction history
- Receipt generation
- Payment validation

## Enums
### Payment Method
- Credit Card
- PayPal
- Bank Transfer
- Digital Wallet

### Payment Status
- Pending
- Completed
- Failed
- Refunded
- Cancelled

## Database Relations
- Many-to-One with User entity
- Uses TypeORM for database operations

## Security Features
- Payment validation
- Amount verification
- User authentication
- Transaction logging
- Error handling

## Integration
- Mail Module for receipts
- User Module for balance updates
- Wallet Module for transactions
- External payment gateways
