import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Genre } from "./genre.schema";
import { modelNames } from "@/common/constants/model-name.constant";
import api from "@/common/utils/axios.util";

@Injectable()
export class GenreService {
  constructor(
    @InjectModel(modelNames.GENRE_MODEL_NAME)
    private genre: Model<Genre>
  ) {
    // this.fetchAllGenres();
  }

  async getGenres() {
    return await this.genre.find({}).select('name').lean();
  }

  async fetchAllGenres() {

    console.log('Fetching genres from API...');
    const genres = await api.get('/genre/movie/list', {
      params: { language: 'en' }
    });
    console.log('Fetched genres from API, total genres:', genres.data.genres.length);

    await this.genre.deleteMany({});

    console.log('Inserting genres to database...');
    const nameToSlug = (name: string) => {
      return name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    }
    const genresToInsert = genres.data.genres.map((genre: any) => ({
      name: genre.name,
      slug: nameToSlug(genre.name),
    }));
    await this.genre.insertMany(genresToInsert);
    console.log('Inserted genres to database successfully');
  }
}