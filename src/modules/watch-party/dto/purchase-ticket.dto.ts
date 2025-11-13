import { IsOptional, IsUUID } from 'class-validator';

export class PurchaseTicketDto {
  @IsOptional()
  @IsUUID()
  ticket_id?: string;
}