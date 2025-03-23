import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EpisodeServer } from "./episode-server.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class EpisodeServerService {
  constructor(
    @InjectModel(modelNames.EPISODE_SERVER_MODEL_NAME) private readonly episodeServerModel: Model<EpisodeServer>
  ) {
  }
}