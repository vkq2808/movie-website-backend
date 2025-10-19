import { MovieStatus, Role } from "@/common/enums";

export interface AdminMovie {
  id: string;
  status: MovieStatus;
  genres: AdminGenre[];
  title: string;
  overview: string;
  original_language: AdminLanguage;
  production_companies: AdminProductionCompany[];
  price: number;

  backdrops: {
    url: string;
    alt: string;
  }[];
  posters: {
    url: string;
    alt: string;
  }[];
  keywords: AdminKeyword[];
  spoken_languages: AdminLanguage[];
  cast: AdminCast[];
  crew: AdminCrew[];

  popularity: number;
  vote_average: number;
  vote_count: number;
  budget: number;
  revenue: number;
  runtime: number;
  adult: boolean;
  purchases: AdminPurchase[];
  original_id: number;
  release_date: string;


  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AdminCast {
  id: string;
  character?: string;
  order?: number;
  person: AdminPerson;
}

export interface AdminCrew {
  id: string;
  job?: string;
  department: string;
  person: AdminPerson;
}

export interface AdminPerson {
  id: string;
  name: string;
  profile_image?: {
    url: string;
    alt: string;
  };
  gender: number;
  adult: boolean;
}

export interface AdminPurchase {
  id: string;
  user: AdminUser;
  movie: AdminMovie;
  purchase_price: number;
  purchased_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AdminKeyword {
  id: string;
  name: string;
}

export interface AdminLanguage {
  id: string;
  name: string;
}

export interface AdminProductionCompany {
  id: string;
  name: string;
}

export interface AdminGenre {
  id: string;
  names: {
    iso_639_1: string;
    name: string;
  }[];
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  created_at: Date;
}