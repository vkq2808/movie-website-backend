import { IsString, IsOptional, IsUUID, IsArray } from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class MovieKeywordResponseDto {
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
}

export class MovieKeywordsResponseDto {
    @Expose()
    @IsUUID(4)
    movie_id: string;

    @Expose()
    @IsArray()
    @Type(() => MovieKeywordResponseDto)
    keywords: MovieKeywordResponseDto[];
}