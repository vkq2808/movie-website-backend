import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
