import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Genre, GENRE_MODEL_NAME } from "./genre.schema";

@Injectable()
export class GenreService {
  constructor(
    @InjectModel(GENRE_MODEL_NAME)
    private genreModel: Model<Genre>
  ) { }
}