import { IsNumber, IsPositive, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddBalanceDto {
  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  @Min(0.01, { message: 'Minimum amount is 0.01' })
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  reference_id?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class DeductBalanceDto {
  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  @Min(0.01, { message: 'Minimum amount is 0.01' })
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
