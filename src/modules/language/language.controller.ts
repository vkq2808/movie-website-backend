import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LanguageService } from './language.service';
import { ApiResponse, ResponseUtil } from '@/common/utils/response.util';
import { RolesGuard } from '@/common/role.guard';
import { Language } from './language.entity';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums';
import { JwtAuthGuard } from '../auth/guards';

@Controller('language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) { }

  @Get()
  async getAllLanguages() {
    console.log('Received request to fetch all languages');
    const languages = await this.languageService.findAll();
    return ResponseUtil.success(languages, 'Languages retrieved successfully.');
  }

  @Get("search")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async findLanguage(
    @Query('query') query: string,
    @Query('limit') limit: number
  ): Promise<ApiResponse<Language[]>> {

    const languages = await this.languageService.findByName(query, limit);

    return {
      data: languages,
      message: "Successfully fetched language",
      success: true
    }
  }

  @Get('/popular')
  async getPopularLanguages(@Query('limit') limit: number = 3) {
    console.log(
      `Received request to fetch popular languages with limit: ${limit}`,
    );
    const languages = await this.languageService.findPopularLanguages(limit);
    return ResponseUtil.success(
      languages,
      'Popular languages retrieved successfully.',
    );
  }

  @Get('/:isoCode')
  async getLanguageByIsoCode(@Param('isoCode') isoCode: string) {
    console.log(`Received request to fetch language with ISO code: ${isoCode}`);
    const language = await this.languageService.findOne({ iso_639_1: isoCode });
    return ResponseUtil.success(language, 'Language retrieved successfully.');
  }
}
