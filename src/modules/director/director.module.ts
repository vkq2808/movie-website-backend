import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { DirectorSchema } from "./director.schema";
import { DirectorService } from "./director.service";
import { DirectorController } from "./director.controller";
import { modelNames } from "@/common/constants/model-name.constant";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: modelNames.DIRECTOR_MODEL_NAME, schema: DirectorSchema }]),
  ],
  providers: [DirectorService],
  controllers: [DirectorController],
})

export class DirectorModule { }