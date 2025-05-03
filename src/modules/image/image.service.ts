import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Image } from "./image.schema";
import { modelNames } from "@/common/constants/model-name.constant";


@Injectable()
export class ImageService {
  constructor(
    @InjectModel(modelNames.IMAGE_MODEL_NAME) private readonly image: Model<Image>,
  ) {
  }

  async getImagePath(imagePath: string): Promise<string> {
    const image = await this.image.findOne({ public_id: imagePath });
    if (!image) {
      throw new Error("Image not found");
    }
    return image.url;
  }
}