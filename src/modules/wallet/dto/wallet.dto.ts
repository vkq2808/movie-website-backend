import { IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddBalanceDto {
  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  @Min(0.01, { message: 'Minimum amount is 0.01' })
  @Type(() => Number)
  amount: number;
}

export class DeductBalanceDto {
  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  @Min(0.01, { message: 'Minimum amount is 0.01' })
  @Type(() => Number)
  amount: number;
}
