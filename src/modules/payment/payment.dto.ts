import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  IsEnum,
  Min,
  IsIn,
} from 'class-validator';
import { enums } from '@/common';

export class CheckoutDto {
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  amount: number;

  @IsNotEmpty({ message: 'Currency is required' })
  @IsString({ message: 'Currency must be a string' })
  @IsIn(['VND', 'USD'], { message: 'Currency must be VND or USD' })
  currency: string;

  @IsNotEmpty({ message: 'Payment method is required' })
  @IsEnum(enums.PaymentMethod, { message: 'Invalid payment method' })
  payment_method: enums.PaymentMethod;

  @IsNotEmpty({ message: 'Return URL is required' })
  @IsUrl({}, { message: 'Return URL must be a valid URL' })
  return_url: string;
}

