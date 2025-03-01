import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EPISODE_SERVER_MODEL_NAME, EpisodeServer } from "./episode-server.schema";

@Injectable()
export class EpisodeServerService {
  constructor(
    @InjectModel(EPISODE_SERVER_MODEL_NAME) private readonly episodeServerModel: Model<EpisodeServer>
  ) {
  }
}