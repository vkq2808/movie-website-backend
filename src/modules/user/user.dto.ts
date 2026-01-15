import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class AdminListUsersQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'admin', 'user'])
  role?: 'all' | 'admin' | 'user';

  @IsOptional()
  @IsIn(['all', 'active', 'inactive'])
  status?: 'all' | 'active' | 'inactive';
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: 'admin' | 'user';

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

// User profile endpoints DTOs
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  birthdate?: string;
}

export class AddFavoriteDto {
  @IsString()
  @IsUUID()
  movieId: string;
}

export class RemoveFavoriteDto {
  @IsString()
  @IsUUID()
  movieId: string;
}

export class SubmitFavoriteGenresDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one genre must be selected' })
  @IsUUID(undefined, { each: true })
  genreIds: string[];
}
