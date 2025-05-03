import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Episode } from "./episode.schema";
import { Model } from "mongoose";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class EpisodeService {
  constructor(
    @InjectModel(modelNames.EPISODE_MODEL_NAME) private episode: Model<Episode>
  ) { }
}