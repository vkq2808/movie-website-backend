import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Genre } from "./genre.entity";
import api from "@/common/utils/axios.util";

@Injectable()
export class GenreService {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>
  ) {
    // this.fetchAllGenres();
  }

  async getGenres() {
    return await this.genreRepository.find();
  }

  async fetchAllGenres() {
    console.log("Fetching genres from API...");
    const genres = await api.get("/genre/movie/list", {
      params: { language: "en" },
    });
    console.log(
      "Fetched genres from API, total genres:",
      genres.data.genres.length
    );

    await this.genreRepository.clear();

    console.log("Inserting genres to database...");
    const nameToSlug = (name: string) => {
      return name
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");
    };
    const genresToInsert = genres.data.genres.map((genre: any) => ({
      name: genre.name,
      slug: nameToSlug(genre.name),
    }));
    await this.genreRepository.save(genresToInsert);
    console.log("Inserted genres to database successfully");
  }
}