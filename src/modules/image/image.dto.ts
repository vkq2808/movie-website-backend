import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteImageDto {
  @IsString()
  @IsNotEmpty()
  url: string;
}