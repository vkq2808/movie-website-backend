import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Actor } from "./actor.schema";
import { modelNames } from "@/common/constants/model-name.constant";

@Injectable()
export class ActorService {
  constructor(
    @InjectModel(modelNames.ACTOR_MODEL_NAME) private readonly actor: Model<Actor>,
  ) { }

}