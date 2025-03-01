import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Actor, ACTOR_MODEL_NAME } from "./actor.schema";

@Injectable()
export class ActorService {
  constructor(
    @InjectModel(ACTOR_MODEL_NAME) private readonly actor: Model<Actor>,
  ) { }

}