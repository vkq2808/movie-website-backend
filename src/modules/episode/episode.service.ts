import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Episode, EPISODE_MODEL_NAME } from "./episode.schema";
import { Model } from "mongoose";

@Injectable()
export class EpisodeService {
  constructor(
    @InjectModel(EPISODE_MODEL_NAME) private episode: Model<Episode>
  ) { }
}