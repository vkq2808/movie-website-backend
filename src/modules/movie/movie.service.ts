import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Movie, MOVIE_MODEL_NAME } from "./movie.schema";


@Injectable()
export class MovieService {
  constructor(
    @InjectModel(MOVIE_MODEL_NAME) private readonly movie: Model<Movie>,
  ) { }
}