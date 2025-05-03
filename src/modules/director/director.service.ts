import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Director } from "./director.schema";
import { Model } from "mongoose";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class DirectorService {
  constructor(
    @InjectModel(modelNames.DIRECTOR_MODEL_NAME) private readonly model: Model<Director>
  ) { }
}