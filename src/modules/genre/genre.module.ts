import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { GENRE_MODEL_NAME, GenreSchema } from "./genre.schema";
import { GenreService } from "./genre.service";
import { GenreController } from "./genre.controller";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: GENRE_MODEL_NAME, schema: GenreSchema }]),
  ],
  providers: [GenreService],
  controllers: [GenreController]
})

export class GenreModule { }