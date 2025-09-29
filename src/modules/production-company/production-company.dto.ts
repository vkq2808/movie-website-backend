import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateProductionCompanyDto {
  @IsNotEmpty({ message: 'Company name is required' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Homepage URL must be a valid URL' })
  homepage?: string;

  @IsOptional()
  @IsString()
  headquarters?: string;

  @IsOptional()
  @IsString()
  origin_country?: string;

  @IsNotEmpty({ message: 'Original company ID is required' })
  @IsInt()
  original_id: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateProductionCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Homepage URL must be a valid URL' })
  homepage?: string;

  @IsOptional()
  @IsString()
  headquarters?: string;

  @IsOptional()
  @IsString()
  origin_country?: string;

  @IsOptional()
  @IsString()
  logo_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class FindProductionCompaniesDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  origin_country?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsInt()
  offset?: number;
}

export class AddMovieToCompanyDto {
  @IsNotEmpty({ message: 'Movie ID is required' })
  @IsString()
  movie_id: string;

  @IsNotEmpty({ message: 'Production company ID is required' })
  @IsString()
  production_company_id: string;
}
