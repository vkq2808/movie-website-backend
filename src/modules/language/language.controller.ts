import { Controller, Get, Param, Query } from "@nestjs/common";
import { LanguageService } from "./language.service";


@Controller("language")
export class LanguageController {
  constructor(
    private readonly languageService: LanguageService
  ) { }

  @Get()
  async getAllLanguages() {
    console.log('Received request to fetch all languages');
    const languages = this.languageService.findAll();
    return languages;
  }

  @Get('/popular')
  async getPopularLanguages(@Query('limit') limit: number = 3) {
    console.log(`Received request to fetch popular languages with limit: ${limit}`);
    return this.languageService.findPopularLanguages(limit);
  }

  @Get('/:isoCode')
  async getLanguageByIsoCode(@Param('isoCode') isoCode: string) {
    console.log(`Received request to fetch language with ISO code: ${isoCode}`);
    return this.languageService.findOne({ iso_639_1: isoCode });
  }
}