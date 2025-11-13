import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateWatchPartyDto } from './create-watch-party.dto';
import { WatchPartyStatus } from '../entities/watch-party.entity';

export class UpdateWatchPartyDto extends PartialType(CreateWatchPartyDto) {
  @IsOptional()
  @IsEnum(WatchPartyStatus)
  status?: WatchPartyStatus;
}