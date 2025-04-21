import { Controller, Get, Param } from "@nestjs/common";
import { ImageService } from "./image.service";


@Controller('image')
export class ImageController {
  constructor(
    private readonly imageService: ImageService
  ) { }

  @Get('id/:imageId')
  async getImagePath(@Param() params: { imageId: string }) {
    return this.imageService.getImagePath(params.imageId);
  }
}