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

  @IsOptional()
  @IsString()
  parent_company?: string;

  @IsOptional()
  @IsString()
  logo_id?: string;

  @IsNotEmpty({ message: 'Original company ID is required' })
  @IsInt()
  original_id: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsNotEmpty({ message: 'Locale code is required' })
  @IsString()
  locale_code: string;

  @IsNotEmpty({ message: 'ISO 639-1 language code is required' })
  @IsString()
  iso_639_1: string;
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
  parent_company?: string;

  @IsOptional()
  @IsString()
  logo_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  locale_code?: string;

  @IsOptional()
  @IsString()
  iso_639_1?: string;
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
