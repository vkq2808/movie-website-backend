import { modelNames } from "@/common/constants/model-name.constant";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ImageSchema } from "./image.schema";


@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: modelNames.IMAGE_MODEL_NAME,
        schema: ImageSchema,
      }
    ])
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class ImageModule { }