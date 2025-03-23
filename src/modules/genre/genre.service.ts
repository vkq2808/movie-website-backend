import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Genre } from "./genre.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class GenreService {
  constructor(
    @InjectModel(modelNames.GENRE_MODEL_NAME)
    private genreModel: Model<Genre>
  ) { }
}