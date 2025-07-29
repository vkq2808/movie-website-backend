import { Controller, Get, Param, Query } from '@nestjs/common';
import { LanguageService } from './language.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) { }

  @Get()
  async getAllLanguages() {
    console.log('Received request to fetch all languages');
    const languages = await this.languageService.findAll();
    return ResponseUtil.success(languages, 'Languages retrieved successfully.');
  }

  @Get('/popular')
  async getPopularLanguages(@Query('limit') limit: number = 3) {
    console.log(
      `Received request to fetch popular languages with limit: ${limit}`,
    );
    const languages = await this.languageService.findPopularLanguages(limit);
    return ResponseUtil.success(languages, 'Popular languages retrieved successfully.');
  }

  @Get('/:isoCode')
  async getLanguageByIsoCode(@Param('isoCode') isoCode: string) {
    console.log(`Received request to fetch language with ISO code: ${isoCode}`);
    const language = await this.languageService.findOne({ iso_639_1: isoCode });
    return ResponseUtil.success(language, 'Language retrieved successfully.');
  }
}
