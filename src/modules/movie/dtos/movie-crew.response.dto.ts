import { IsString, IsOptional, IsNumber, IsUUID, IsArray } from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class ProfileImageResponseDto {
    @Expose()
    @IsString()
    url: string;

    @Expose()
    @IsString()
    alt: string;

    @Expose()
    @IsOptional()
    @IsString()
    server_path?: string;
}

export class PersonResponseDto {
    @Expose()
    @IsUUID(4)
    id: string;

    @Expose()
    @IsString()
    name: string;

    @Expose()
    @IsOptional()
    @Type(() => ProfileImageResponseDto)
    profile_image?: ProfileImageResponseDto;
}

export class MovieCrewMemberResponseDto {
    @Expose()
    @IsUUID(4)
    id: string;

    @Expose()
    @IsString()
    department: string;

    @Expose()
    @IsString()
    job: string;

    @Expose()
    @IsNumber()
    order: number;

    @Expose()
    @IsOptional()
    @IsString()
    credit_id?: string;

    @Expose()
    @Type(() => PersonResponseDto)
    person: PersonResponseDto;
}

export class MovieCrewResponseDto {
    @Expose()
    @IsUUID(4)
    movie_id: string;

    @Expose()
    @IsArray()
    @Type(() => MovieCrewMemberResponseDto)
    crew: MovieCrewMemberResponseDto[];
}