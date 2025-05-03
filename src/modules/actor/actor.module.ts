import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ActorController } from "./actor.controller";
import { ActorService } from "./actor.service";
import { ActorSchema } from "./actor.schema";
import { modelNames } from "@/common/constants/model-name.constant";


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: modelNames.ACTOR_MODEL_NAME, schema: ActorSchema }]),
  ],
  controllers: [ActorController],
  providers: [ActorService]
})

export class ActorModule { }