import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  JoinTable,
} from 'typeorm';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { Movie } from '../movie/movie.entity';
import { modelNames } from '@/common/constants/model-name.constant';

@Entity({ name: modelNames.GENRE_MODEL_NAME })
export class Genre {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'jsonb', default: [] })
  @IsObject({ each: true })
  names: { name: string; iso_639_1: string }[];

  // Original ID from the external API (TMDB)
  @Column({ nullable: true })
  original_id: number;
  @ManyToMany(() => Movie, (movie) => movie.genres)
  @JoinTable({
    name: modelNames.MOVIE_GENRES,
    joinColumn: { name: 'genre_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'movie_id', referencedColumnName: 'id' },
  })
  movies: Movie[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
  @BeforeInsert()
  @BeforeUpdate()
  formatNames() {
    if (!this.names) {
      this.names = [];
    }
    // Ensure unique combinations of name and language
    this.names = this.names.filter(
      (value, index, self) =>
        index ===
        self.findIndex(
          (t) => t.name === value.name && t.iso_639_1 === value.iso_639_1,
        ),
    );
  }

  static formatNameForSearch(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD') // Normalize to decomposed form
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '-'); // Replace non-alphanumeric with hyphens
  }

  static create(name: string, languageCode: string): Partial<Genre> {
    const genre = new Genre();
    genre.names = [{ name, iso_639_1: languageCode }];
    return genre;
  }
}
