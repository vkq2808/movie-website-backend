import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Movie } from "./movie.schema";
import { modelNames } from "@/common/constants/model-name.constant";


@Injectable()
export class MovieService {
  constructor(
    @InjectModel(modelNames.MOVIE_MODEL_NAME) private readonly movie: Model<Movie>,
  ) { }
}