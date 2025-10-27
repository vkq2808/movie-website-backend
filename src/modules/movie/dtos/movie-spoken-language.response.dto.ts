import { IsString, IsUUID, IsArray } from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class MovieSpokenLanguageResponseDto {
    @Expose()
    @IsUUID(4)
    id: string;

    @Expose()
    @IsString()
    name: string;

    @Expose()
    @IsString()
    iso_639_1: string;
}

export class MovieSpokenLanguagesResponseDto {
    @Expose()
    @IsUUID(4)
    movie_id: string;

    @Expose()
    @IsArray()
    @Type(() => MovieSpokenLanguageResponseDto)
    spoken_languages: MovieSpokenLanguageResponseDto[];
}