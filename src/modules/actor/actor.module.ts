import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ActorController } from "./actor.controller";
import { ActorService } from "./actor.service";
import { ACTOR_MODEL_NAME, ActorSchema } from "./actor.schema";


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: ACTOR_MODEL_NAME, schema: ActorSchema }]),
  ],
  controllers: [ActorController],
  providers: [ActorService]
})

export class ActorModule { }