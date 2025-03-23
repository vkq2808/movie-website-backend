import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { GenreSchema } from "./genre.schema";
import { GenreService } from "./genre.service";
import { GenreController } from "./genre.controller";
import { modelNames } from "@/common/constants/model-name.constant";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: modelNames.GENRE_MODEL_NAME, schema: GenreSchema }]),
  ],
  providers: [GenreService],
  controllers: [GenreController]
})

export class GenreModule { }