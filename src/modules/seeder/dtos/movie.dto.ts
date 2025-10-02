import { ProductionCompany } from "@/modules/production-company/production-company.entity";

export type MovieCredits = {
  id: number;
  cast: TMDBMovieCast[];
  crew: TMDBMovieCrew[];
};

export type TMDBMovieCast = {
  id: number;
  name: string;
  character: string;
  profile_path?: string;
  cast_id: number;
  adult: boolean;
  gender: number;
  order: number;
  popularity: number;
  known_for_department: string;
  original_name: string;
};

export type TMDBMovieCrew = {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string;
  credit_id: string;
  department: string;
  job: string;
};

export type TMDBDiscoverMovie = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  genre_ids: number[];
};

export type TMDBMovieImage = {
  aspect_ratio: number;
  file_path: string;
  height: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
  width: number;
};

// Subset of TMDB Movie Details response we actually use
export type TMDBMovieDetails = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  backdrops: TMDBMovieImage[];
  posters: TMDBMovieImage[];
  original_language: string;
  genres: { id: number; name: string }[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  production_companies?: {
    id: string;
    name: string;
    origin_country: string
  }[];
  runtime?: number | null;
  status?: string | null;
  tagline?: string | null;
  credits: MovieCredits;
  alternative_titles?: {
    title: string;
    iso_3166_1: string;
  }[];
  spoken_languages: {
    iso_639_1: string;
    name: string;
    english_name: string;
  }[];
};

export type MovieBatch = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  backdrops: TMDBMovieImage[];
  posters: TMDBMovieImage[];
  original_language: string;
  genres: { id: number; name: string }[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  production_companies?: ProductionCompany[];
  runtime?: number | null;
  status?: string | null;
  tagline?: string | null;
  credits: MovieCredits;
  alternative_titles?: {
    title: string;
    iso_3166_1: string;
  }[];
  spoken_languages: {
    iso_639_1: string;
    name: string;
    english_name: string;
  }[];
}