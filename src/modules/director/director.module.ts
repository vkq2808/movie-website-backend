import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { DIRECTOR_MODEL_NAME, DirectorSchema } from "./director.schema";
import { DirectorService } from "./director.service";
import { DirectorController } from "./director.controller";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: DIRECTOR_MODEL_NAME, schema: DirectorSchema }]),
  ],
  providers: [DirectorService],
  controllers: [DirectorController],
})

export class DirectorModule { }