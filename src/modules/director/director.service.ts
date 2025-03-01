import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Director, DIRECTOR_MODEL_NAME } from "./director.schema";
import { Model } from "mongoose";

@Injectable()
export class DirectorService {
  constructor(
    @InjectModel(DIRECTOR_MODEL_NAME) private readonly model: Model<Director>
  ) { }
}