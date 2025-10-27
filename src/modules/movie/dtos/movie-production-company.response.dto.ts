import { IsString, IsOptional, IsUrl, IsBoolean, IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';

export class MovieProductionCompanyResponseDto {
    @Expose()
    @IsUUID(4)
    id: string;

    @Expose()
    @IsString()
    name: string;

    @Expose()
    @IsOptional()
    @IsString()
    description?: string;

    @Expose()
    @IsOptional()
    @IsUrl({}, { message: 'Homepage URL must be a valid URL' })
    homepage?: string;

    @Expose()
    @IsOptional()
    @IsString()
    headquarters?: string;

    @Expose()
    @IsOptional()
    @IsString()
    origin_country?: string;

    @Expose()
    @IsOptional()
    @IsString()
    logo_id?: string;

    @Expose()
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class MovieProductionCompaniesResponseDto {
    @Expose()
    @IsUUID(4)
    movie_id: string;

    @Expose()
    production_companies: MovieProductionCompanyResponseDto[];
}