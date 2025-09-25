import { Injectable } from '@nestjs/common';
import { Language } from '../../language/language.entity';
import { LanguageService } from '../../language/language.service';
import { TOP_LANGUAGES } from '@/common/constants/languages.constant';

@Injectable()
export class LanguageCrawlerService {
  constructor(private readonly languageService: LanguageService) {}

  async initializeLanguagesInBatches(): Promise<Language[]> {
    const BATCH_SIZE = 5;
    const languages: Language[] = [];
    const topLanguages = TOP_LANGUAGES;
    for (let i = 0; i < topLanguages.length; i += BATCH_SIZE) {
      const batch = topLanguages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((lang) =>
        this.languageService
          .findOrCreate({ iso_639_1: lang.code })
          .catch((error) => {
            console.error(`Failed to initialize language ${lang.code}:`, error);
            return null;
          }),
      );
      const batchResults = await Promise.all(batchPromises);
      languages.push(
        ...batchResults.filter((lang): lang is Language => lang !== null),
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return languages;
  }
}
